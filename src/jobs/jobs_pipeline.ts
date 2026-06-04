import * as fs from 'fs';
import * as path from 'path';
import { BasePipeline } from '../core/BasePipeline';
import { JobMeta, LinkedInMarkdownConverter } from './jobs_converter';
import { LinkedInCrawler } from '../crawler';
import { UrlUtils, NamingUtils } from '../utils';

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

    protected async saveResults(meta: JobMeta, id: string, tempHtmlPath: string): Promise<{ mdPath: string; htmlPath: string; targetDirName: string }> {
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
                await this.extractAndPushRecommendations(rawHtml, dbInstance, bronzeJobs);
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
            mdPath: '', // 마크다운 로컬 저장 해제
            htmlPath: '', // HTML 경로 반환값 비워둠 (로컬 저장 해제)
            targetDirName: `${meta.locationDirName}/${meta.postedDate}`
        };
    }

    /**
     * ⚡ [대안 A] 상세 페이지 수집 완료 시 자동 추천 공고 파싱 및 Redis 큐 적재
     */
    private async extractAndPushRecommendations(htmlContent: string, dbInstance: any, bronzeJobs: any): Promise<void> {
        const cheerio = require('cheerio');
        const $ = cheerio.load(htmlContent);
        const jobUrlsColl = await dbInstance.getCollection('bronze.job_urls');
        
        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        const Redis = require('ioredis');
        const redis = new Redis(redisUrl);

        // 1. target locations 로드
        let targetLocations = ['South Korea', 'United Arab Emirates', 'Japan'];
        try {
            const configPath = path.join(__dirname, '..', '..', 'config', 'config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                if (config.search_targets) {
                    targetLocations = config.search_targets.map((t: any) => t.location);
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
            for (const [country, aliases] of Object.entries(countryMapping)) {
                if (country === 'South Korea' && /[가-힣]/.test(loc)) return country;
                const escapedAliases = aliases.map(alias => alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
                if (escapedAliases.length > 0) {
                    const pattern = new RegExp(`\\b(${escapedAliases.join('|')})\\b`, 'i');
                    if (pattern.test(loc)) return country;
                }
            }
            return 'Others';
        };

        // 3. 완료된 캐시 로드
        const completedCache = new Set<string>();
        const completedDocs = await bronzeJobs.find({}, { projection: { jobId: 1, _id: 0 } }).toArray();
        completedDocs.forEach((d: any) => {
            if (d.jobId) completedCache.add(d.jobId);
        });

        // 4. 추천 공고 파싱
        const foundJobs: any[] = [];
        $('a[href*="/jobs/view/"]').each((_: any, el: any) => {
            const href = $(el).attr('href') || '';
            const jobId = UrlUtils.extractJobId(href);
            if (!jobId || !/^\d+$/.test(jobId)) return;

            const title = $(el).text().replace(/\s+/g, ' ').trim();
            if (!title || title.length < 2) return;

            let company = '정보 없음';
            let location = '정보 없음';

            const parent = $(el).closest('li, div, section');
            if (parent.length > 0) {
                const companyText = parent.find('[class*="company"], [class*="subtitle"]').first().text().replace(/\s+/g, ' ').trim();
                if (companyText) company = companyText;
                const locText = parent.find('[class*="location"], [class*="metadata"]').first().text().replace(/\s+/g, ' ').trim();
                if (locText) {
                    location = locText.split(/\d+\s+days?\s+ago|\d+\s+weeks?\s+ago/i)[0].trim();
                }
            }

            const geo = parseGeo(location);
            if (targetLocations.includes(geo)) {
                foundJobs.push({
                    jobId,
                    title,
                    company,
                    location,
                    geo,
                    url: `https://www.linkedin.com/jobs/view/${jobId}`
                });
            }
        });

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
                        pushedToRedis: isCompleted ? true : false
                    }
                },
                { upsert: true }
            );

            if (!isCompleted && !alreadyPushed) {
                await redis.rpush('jobs_queue', job.url);
                await jobUrlsColl.updateOne(
                    { jobId: job.jobId },
                    { $set: { pushedToRedis: true } }
                );
                pushedCount++;
            }
        }
        if (pushedCount > 0) {
            console.log(`📋 [Auto-Extract Rec Details] Extracted target recommendations:\n${JSON.stringify(foundJobs, null, 2)}`);
            console.log(`✅ [Auto-Extract Rec] Found ${foundJobs.length} recommendations. Pushed ${pushedCount} new jobs to Redis jobs_queue.`);
        }
        await redis.quit();
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
