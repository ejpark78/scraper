import * as fs from 'fs';
import * as path from 'path';
import { BasePipeline } from '../../core/BasePipeline';
import { JobMeta, LinkedInMarkdownConverter } from './jobs_converter';
import { LinkedInCrawler } from '../../crawler';
import { UrlUtils, NamingUtils } from '../../utils';

export class JobsScrapingPipeline extends BasePipeline<JobMeta> {
    private readonly crawler: LinkedInCrawler;
    private readonly converter: LinkedInMarkdownConverter;

    constructor() {
        super();
        
        this.crawler = new LinkedInCrawler({ login: process.env.LOGIN === 'true' || process.env.AUTH === 'true' });
        this.converter = new LinkedInMarkdownConverter();
    }

    protected extractId(url: string): string {
        return UrlUtils.extractJobId(url);
    }

    protected getDomainName(): string {
        return '채용공고';
    }

    protected async executeScrape(url: string, tempHtmlPath: string): Promise<void> {
        await this.crawler.scrapeJob(url, tempHtmlPath);
    }

    protected processMetadata(htmlContent: string, id: string, url: string): JobMeta {
        // 임시 파일 경로 대신 현재 시각을 기준으로 Date 파싱
        return this.converter.convertHtmlToMarkdown(htmlContent, id, url);
    }

    protected async saveResults(meta: JobMeta, id: string, tempHtmlPath: string, redisInstance?: any): Promise<{ targetDirName: string }> {
        // 임시 파일에서 원시 HTML 콘텐츠 읽기
        const rawHtml = fs.readFileSync(tempHtmlPath, 'utf-8');

        // ⚡ [MongoDB 적재] ⚡
        try {
            const { MongoDatabase } = require('../database/mongo');
            const dbInstance = MongoDatabase.getInstance();

            // 1. Bronze Layer (Raw) 저장
            const bronzeJobs = await dbInstance.getCollection('bronze.jobs');
            await bronzeJobs.updateOne(
                { jobId: id },
                { 
                    $set: { 
                        jobId: id,
                        rawHtml: rawHtml,
                        collectedAt: new Date()
                    } 
                },
                { upsert: true }
            );

            // 2. Silver Layer (Cleansed) 저장
            const silverJobs = await dbInstance.getCollection('silver.jobs');
            const stdLoc = UrlUtils.standardizeLocation(meta.rawLocation);
            await silverJobs.updateOne(
                { jobId: id },
                {
                    $set: {
                        jobId: id,
                        title: meta.jobTitle,
                        companyName: meta.company,
                        companyId: meta.company ? NamingUtils.generateSafeFileName(meta.company, '') : null, 
                        description: meta.rawContent,
                        location: meta.rawLocation,
                        geo: stdLoc || 'Unknown',
                        workStyle: '정보 없음',
                        url: `https://www.linkedin.com/jobs/view/${id}`,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
            console.log(`📡 [MongoDB Write] Successfully saved Job ID ${id} to bronze.jobs and silver.jobs.`);

            // 3. 추천 공고 실시간 파싱 및 Redis 큐 적재
            try {
                await this.extractAndPushRecommendations(rawHtml, dbInstance, bronzeJobs, redisInstance);
            } catch (recErr: any) {
                console.warn(`⚠️ [Auto-Extract Rec Warning] Failed to extract/push recommendations for Job ${id}: ${recErr.message}`);
            }
        } catch (dbErr: any) {
            console.error(`❌ [MongoDB Write Error] Failed to write Job ${id} to DB: ${dbErr.message}`);
            throw dbErr; // DB 적재가 실패할 경우 예외를 전파하여 중단
        } finally {
            // 사용 완료된 임시 HTML 파일 삭제 (디스크 절약)
            if (fs.existsSync(tempHtmlPath)) {
                fs.unlinkSync(tempHtmlPath);
            }
        }

        return {
            targetDirName: `${meta.locationDirName}/${meta.postedDate}`
        };
    }

    /**
     * ⚡ [대안 A] 상세 페이지 수집 완료 시 자동 추천 공고 파싱 및 Redis 큐 적재
     */
    private async extractAndPushRecommendations(htmlContent: string, dbInstance: any, bronzeJobs: any, redisInstance?: any): Promise<void> {
        const cheerio = require('cheerio');
        const $ = cheerio.load(htmlContent);
        const jobUrlsColl = await dbInstance.getCollection('bronze.job_urls');
        
        let redis = redisInstance;
        let shouldQuitRedis = false;
        if (!redis) {
            const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
            const Redis = require('ioredis');
            redis = new Redis(redisUrl);
            shouldQuitRedis = true;
        }

        // 1. target locations 로드
        let targetLocations = ['South Korea', 'United Arab Emirates', 'Japan'];
        try {
            const configPath = path.join(__dirname, '..', '..', 'config', 'config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                if (config.search_targets) {
                    targetLocations = config.search_targets
                        .filter((t: any) => t.enabled !== false)
                        .map((t: any) => t.location);
                }
            }
        } catch (e: any) {}

        // 2. country mapping 로드
        let countryMapping: Record<string, string[]> = {};
        try {
            const countryJsonPath = path.join(__dirname, '..', '..', 'config', 'country.json');
            if (fs.existsSync(countryJsonPath)) {
                countryMapping = JSON.parse(fs.readFileSync(countryJsonPath, 'utf-8'));
            }
        } catch (e: any) {}

        const parseGeo = (loc: string): string => {
            const std = UrlUtils.standardizeLocation(loc);
            if (std === 'unknown-location') return 'Others';
            for (const country of Object.keys(countryMapping)) {
                if (std.toLowerCase() === country.toLowerCase()) return country;
            }
            return 'Others';
        };

        // 3. 추천 공고 파싱
        const foundJobs: any[] = [];
        $('a[href*="/jobs/view/"]').each((_: any, el: any) => {
            const href = $(el).attr('href') || '';
            const jobId = UrlUtils.extractJobId(href);
            if (!jobId || !/^\d+$/.test(jobId)) return;

            const title = $(el).text().replace(/\s+/g, ' ').trim();
            if (!title || title.length < 2) return;

            let company = '정보 없음';
            let location = '정보 없음';

            const parent = $(el).closest('li');
            if (parent.length > 0) {
                const companyText = parent.find('[class*="company"], [class*="subtitle"], [class*="secondary"]').first().text().replace(/\s+/g, ' ').trim();
                if (companyText) company = companyText;
                const locText = parent.find('[class*="location"], [class*="metadata"]').first().text().replace(/\s+/g, ' ').trim();
                if (locText) {
                    location = locText.split(/\d+\s+days?\s+ago|\d+\s+weeks?\s+ago/i)[0].trim();
                }
            }

            const geo = parseGeo(location);
            const matchesTarget = targetLocations.includes(geo);

            foundJobs.push({
                jobId,
                title,
                company,
                location,
                geo,
                matchesTarget,
                url: `https://www.linkedin.com/jobs/view/${jobId}`
            });
        });

        if (foundJobs.length === 0) {
            if (shouldQuitRedis && redis) {
                await redis.quit();
            }
            return;
        }

        // 4. 완료된 캐시 로드 ($in 쿼리 및 Redis sismember 활용으로 최적화)
        const completedCache = new Set<string>();
        const uniqueJobIds = Array.from(new Set(foundJobs.map(j => j.jobId)));
        
        // 4-1. Redis 캐시가 주입되어 있으면 Redis에서 우선 확인하여 속도 최적화
        const redisCheckedCache = new Set<string>();
        if (redis) {
            try {
                // Redis의 SISMEMBER를 통해 존재 확인
                const pipeline = redis.pipeline();
                uniqueJobIds.forEach(id => {
                    pipeline.sismember('completed_jobs', id);
                });
                const results = await pipeline.exec();
                if (results) {
                    results.forEach((res: any, idx: number) => {
                        const [err, isMember] = res;
                        if (!err && isMember === 1) {
                            completedCache.add(uniqueJobIds[idx]);
                            redisCheckedCache.add(uniqueJobIds[idx]);
                        }
                    });
                }
            } catch (err: any) {
                console.warn(`⚠️ [Redis Cache Check Warning] Failed checking completed_jobs cache in Redis: ${err.message}`);
            }
        }

        // 4-2. Redis에 없는 공고들에 대해 MongoDB $in 조건으로 정밀 타겟 조회 (대용량 테이블 풀스캔 우회)
        const mongoCheckIds = uniqueJobIds.filter(id => !redisCheckedCache.has(id));
        if (mongoCheckIds.length > 0) {
            try {
                const completedDocs = await bronzeJobs.find(
                    { jobId: { $in: mongoCheckIds } },
                    { projection: { jobId: 1, _id: 0 } }
                ).toArray();
                completedDocs.forEach((d: any) => {
                    if (d.jobId) completedCache.add(d.jobId);
                });
            } catch (mongoErr: any) {
                console.error(`⚠️ [MongoDB Cache Check Error] Failed checking jobs in Mongo: ${mongoErr.message}`);
            }
        }

        // 5. DB 저장 및 Redis 큐 적재
        let pushedCount = 0;
        for (const job of foundJobs) {
            const isCompleted = completedCache.has(job.jobId);
            const currentDoc = await jobUrlsColl.findOne({ jobId: job.jobId });
            const alreadyPushed = currentDoc?.pushedToRedis === true;

            await jobUrlsColl.updateOne(
                { jobId: job.jobId },
                {
                    $set: {
                        jobId: job.jobId,
                        url: job.url,
                        title: job.title,
                        company: job.company,
                        location: job.location,
                        geo: job.geo,
                        source: 'related',
                        status: isCompleted ? 'completed' : 'new',
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        pushedToRedis: (isCompleted || !job.matchesTarget) ? true : false
                    }
                },
                { upsert: true }
            );

            if (job.matchesTarget && !isCompleted && !alreadyPushed) {
                await redis.rpush('jobs_queue', job.url);
                await jobUrlsColl.updateOne(
                    { jobId: job.jobId },
                    { $set: { pushedToRedis: true } }
                );
                pushedCount++;
            } else if (!job.matchesTarget) {
                // 타겟 매칭이 아닌 경우 주입 대기를 위해 pushedToRedis: false로 확실히 보정
                await jobUrlsColl.updateOne(
                    { jobId: job.jobId },
                    { $set: { pushedToRedis: false } }
                );
            }
        }
        if (pushedCount > 0) {
            console.log(`📋 [Auto-Extract Rec Details] Extracted target recommendations:\n${JSON.stringify(foundJobs.filter(j => j.matchesTarget && !completedCache.has(j.jobId)), null, 2)}`);
            console.log(`✅ [Auto-Extract Rec] Found ${foundJobs.length} recommendations. Pushed ${pushedCount} new jobs to Redis jobs_queue.`);
        }
        
        if (shouldQuitRedis && redis) {
            await redis.quit();
        }
    }
}

// 스크립트 단독 기동 처리
if (require.main === module) {
    const urlsFile = process.argv[2];
    if (!urlsFile) {
        console.error('❌ 사용법: npx ts-node jobs_pipeline.ts <채용공고_URL_목록_파일_경로>');
        process.exit(1);
    }

    const pipeline = new JobsScrapingPipeline();
    pipeline.run(urlsFile).catch(err => {
        console.error(`❌ 채용공고 파이프라인 구동 실패: ${err.message}`);
        process.exit(1);
    });
}
