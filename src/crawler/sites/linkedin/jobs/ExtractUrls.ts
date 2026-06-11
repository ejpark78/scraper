/**
 * @module ExtractUrls
 * @description Core functionality or script runner for ExtractUrls.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies mongo, utils, ioredis, fs, path
 * @lastUpdated 2026-06-11
 */

import { MongoDatabase } from '../../../../database/mongo';
import { UrlUtils } from '../../../utils';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

export class JobsExtractUrls {
    public async run(): Promise<void> {
    console.log('🏁 [Extract Urls] Starting comprehensive HTML URL extraction from bronze/linkedin.jobs and bronze/linkedin.lists...');
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();
    const bronzeJobs = await mongo.getCollection('bronze/linkedin.jobs');
    const bronzeLists = await mongo.getCollection('bronze/linkedin.lists');
    const jobUrlsColl = await mongo.getCollection('bronze/linkedin.job_urls');
    const companyUrlsColl = await mongo.getCollection('bronze/linkedin.company_urls');

    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const redis = new Redis(redisUrl);

    // 1. target locations 로드
    let targetLocations = ['South Korea', 'United Arab Emirates', 'Japan'];
    try {
        const configPath = path.join(__dirname, '..', '..', '..', 'config', 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.search_targets) {
                targetLocations = config.search_targets
                    .filter((t: any) => t.enabled !== false)
                    .map((t: any) => t.location);
            }
        }
    } catch (e: any) {}
    console.log('🎯 Target locations:', targetLocations);

    // 2. country mapping 로드
    let countryMapping: Record<string, string[]> = {};
    try {
        const countryJsonPath = path.join(__dirname, '..', '..', '..', 'config', 'country.json');
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

    // 3. 완료 및 기존 수집 캐시 로드
    const completedCache = new Set<string>();
    const jobIds = await bronzeJobs.distinct('jobId');
    jobIds.forEach((jobId: any) => {
        if (jobId) completedCache.add(jobId);
    });

    const pushedUrls = new Set<string>();
    const pushedJobIds = await jobUrlsColl.distinct('jobId');
    pushedJobIds.forEach((jobId: any) => {
        if (jobId) pushedUrls.add(jobId);
    });

    console.log(`🔌 Loaded ${completedCache.size} completed jobs and ${pushedUrls.size} discovered job URLs from DB.`);

    const cheerio = require('cheerio');
    const jobOps: any[] = [];
    const redisPushBuffer: string[] = [];
    const sleepSec = parseInt(process.env.SLACK_TIME || '1', 10);
    const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '100', 10);

    // ==========================================
    // 4-A. Scan bronze/linkedin.lists (Search lists) via Cursor
    // ==========================================
    console.log('\n🔍 [Phase 1/2] Scanning bronze/linkedin.lists HTML for target jobs...');
    const totalLists = await bronzeLists.countDocuments();
    const listCursor = bronzeLists.find({}, { projection: { listId: 1, rawHtml: 1 } }).batchSize(CHUNK_SIZE);
    let listIdx = 0;
    const startTime = Date.now();

    const companyHrefRegex = /href="([^"]*\/comp(?:any|ay)\/[^"]*)"/g;

    while (await listCursor.hasNext()) {
        const doc = await listCursor.next();
        if (!doc) continue;
        
        listIdx++;
        const htmlContent = doc.rawHtml || '';
        const $ = cheerio.load(htmlContent);

        // 경과 시간 및 예상 완료 시간(ETR) 계산
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const pad = (n: number) => String(n).padStart(2, '0');
        const formatSeconds = (secs: number) => {
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = secs % 60;
            return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
        };
        const runtimeStr = formatSeconds(elapsedSeconds);
        
        let etrStr = '계산 중...';
        if (listIdx > 1) {
            const avgSpeed = elapsedSeconds / (listIdx - 1);
            const remainingSeconds = Math.floor(avgSpeed * (totalLists - listIdx + 1));
            etrStr = formatSeconds(remainingSeconds);
        }

        console.log(`📡 [Lists ${listIdx}/${totalLists}][${runtimeStr}/${etrStr}] Scanning List ID: ${doc.listId}...`);

        $('a[href*="/jobs/view/"]').each((_: any, el: any) => {
            const href = $(el).attr('href') || '';
            const jobId = UrlUtils.extractJobId(href);
            if (!jobId || !/^\d+$/.test(jobId)) return;

            if (completedCache.has(jobId) || pushedUrls.has(jobId)) return;

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
            const isTarget = targetLocations.includes(geo);
            
            console.log(`  [Discovered] ID: ${jobId} | Title: ${title} | Company: ${company} | Location: ${location} | Geo: ${geo} | Matches Target: ${isTarget}`);

            pushedUrls.add(jobId);
            const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
            jobOps.push({
                updateOne: {
                    filter: { jobId },
                    update: {
                        $set: {
                            jobId,
                            url: jobUrl,
                            title,
                            company,
                            location,
                            geo,
                            source: 'DIRECT',
                            status: 'new',
                            pushedToRedis: isTarget,
                            updatedAt: new Date()
                        }
                    },
                    upsert: true
                }
            });

            if (isTarget) {
                redisPushBuffer.push(jobUrl);
            }
        });

        // Extract company URLs
        let compMatch;
        companyHrefRegex.lastIndex = 0;
        while ((compMatch = companyHrefRegex.exec(htmlContent)) !== null) {
            let url = compMatch[1].trim().split('?')[0].replace(/\/$/, '');
            if (url.startsWith('/company') || url.startsWith('/compay')) {
                url = 'https://www.linkedin.com' + url;
            }
            if (url.startsWith('http') && (url.includes('/company/') || url.includes('/compay/'))) {
                const companyId = UrlUtils.extractCompanyId(url);
                if (companyId) {
                    await companyUrlsColl.updateOne(
                        { companyId },
                        {
                            $set: {
                                companyId,
                                url: `https://www.linkedin.com/company/${companyId}`,
                                status: 'new',
                                updatedAt: new Date()
                            },
                            $setOnInsert: { pushedToRedis: false }
                        },
                        { upsert: true }
                    );
                }
            }
        }

        // CHUNK_SIZE 단위로 DB 부하 방지를 위해 슬립 대기
        if (listIdx % CHUNK_SIZE === 0 && sleepSec > 0 && listIdx < totalLists) {
            console.log(`💤 [대기] DB 부하 방지를 위해 ${sleepSec}초 대기 중... (CHUNK: ${CHUNK_SIZE}개 완료)`);
            await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
        }
    }

    // ==========================================
    // 4-B. Scan bronze/linkedin.jobs (Detail pages) via Cursor
    // ==========================================
    console.log('\n🔍 [Phase 2/2] Scanning bronze/linkedin.jobs HTML for jobs...');
    const totalJobs = await bronzeJobs.countDocuments();
    const jobCursor = bronzeJobs.find({}, { projection: { jobId: 1, rawHtml: 1 } }).batchSize(CHUNK_SIZE);
    let jobIdx = 0;
    const jobStartTime = Date.now();

    while (await jobCursor.hasNext()) {
        const doc = await jobCursor.next();
        if (!doc) continue;

        jobIdx++;
        const htmlContent = doc.rawHtml || '';
        const $ = cheerio.load(htmlContent);

        // 경과 시간 및 예상 완료 시간(ETR) 계산
        const elapsedSeconds = Math.floor((Date.now() - jobStartTime) / 1000);
        const pad = (n: number) => String(n).padStart(2, '0');
        const formatSeconds = (secs: number) => {
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = secs % 60;
            return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
        };
        const runtimeStr = formatSeconds(elapsedSeconds);
        
        let etrStr = '계산 중...';
        if (jobIdx > 1) {
            const avgSpeed = elapsedSeconds / (jobIdx - 1);
            const remainingSeconds = Math.floor(avgSpeed * (totalJobs - jobIdx + 1));
            etrStr = formatSeconds(remainingSeconds);
        }

        console.log(`... [Jobs ${jobIdx}/${totalJobs}][${runtimeStr}/${etrStr}] Scanning Job ID: ${doc.jobId}...`);

        $('a[href*="/jobs/view/"]').each((_: any, el: any) => {
            const href = $(el).attr('href') || '';
            const jobId = UrlUtils.extractJobId(href);
            if (!jobId || !/^\d+$/.test(jobId)) return;

            if (completedCache.has(jobId) || pushedUrls.has(jobId)) return;

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
            const isTarget = targetLocations.includes(geo);

            console.log(`  [Discovered Rec] ID: ${jobId} | Title: ${title} | Company: ${company} | Location: ${location} | Geo: ${geo} | Matches Target: ${isTarget}`);

            pushedUrls.add(jobId);
            const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
            jobOps.push({
                updateOne: {
                    filter: { jobId },
                    update: {
                        $set: {
                            jobId,
                            url: jobUrl,
                            title,
                            company,
                            location,
                            geo,
                            source: 'related',
                            status: 'new',
                            pushedToRedis: isTarget,
                            updatedAt: new Date()
                        }
                    },
                    upsert: true
                }
            });

            if (isTarget) {
                redisPushBuffer.push(jobUrl);
            }
        });

        // Extract company URLs from detail HTML
        let compMatch;
        companyHrefRegex.lastIndex = 0;
        while ((compMatch = companyHrefRegex.exec(htmlContent)) !== null) {
            let url = compMatch[1].trim().split('?')[0].replace(/\/$/, '');
            if (url.startsWith('/company') || url.startsWith('/compay')) {
                url = 'https://www.linkedin.com' + url;
            }
            if (url.startsWith('http') && (url.includes('/company/') || url.includes('/compay/'))) {
                const companyId = UrlUtils.extractCompanyId(url);
                if (companyId) {
                    await companyUrlsColl.updateOne(
                        { companyId },
                        {
                            $set: {
                                companyId,
                                url: `https://www.linkedin.com/company/${companyId}`,
                                status: 'new',
                                updatedAt: new Date()
                            },
                            $setOnInsert: { pushedToRedis: false }
                        },
                        { upsert: true }
                    );
                }
            }
        }

        // CHUNK_SIZE 단위로 DB 부하 방지를 위해 슬립 대기
        if (jobIdx % CHUNK_SIZE === 0 && sleepSec > 0 && jobIdx < totalJobs) {
            console.log(`💤 [대기] DB 부하 방지를 위해 ${sleepSec}초 대기 중... (CHUNK: ${CHUNK_SIZE}개 완료)`);
            await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
        }
    }

    // DB 저장 및 Redis 적재
    const totalFound = redisPushBuffer.length;
    console.log(`\n📊 Backfill Scan Summary:`);
    console.log(`- Total new target jobs discovered from HTML: ${totalFound}`);

    if (jobOps.length > 0) {
        console.log(`📥 Saving ${jobOps.length} entries to bronze/linkedin.job_urls in MongoDB...`);
        const chunkSize = 1000;
        for (let i = 0; i < jobOps.length; i += chunkSize) {
            const chunk = jobOps.slice(i, i + chunkSize);
            await jobUrlsColl.bulkWrite(chunk);
        }
        console.log('✅ bronze/linkedin.job_urls updated.');
    }

    if (redisPushBuffer.length > 0) {
        console.log(`📥 Pushing ${redisPushBuffer.length} URLs to Redis scrape_queue...`);
        const payloads = redisPushBuffer.map(url => JSON.stringify({
            site: 'linkedin',
            url,
            attempt: 1
        }));
        
        const chunkSize = 1000;
        for (let i = 0; i < payloads.length; i += chunkSize) {
            const chunk = payloads.slice(i, i + chunkSize);
            await redis.rpush('scrape_queue', ...chunk);
        }
        console.log('✅ Redis scrape_queue updated.');
    } else {
        console.log('💡 No new target jobs found to backfill.');
    }

    await redis.quit();
    await mongo.close();
    console.log('🎉 [Comprehensive URL Extraction] Complete!');
}
}

if (require.main === module) {
    const extractUrls = new JobsExtractUrls();
    extractUrls.run().catch(err => {
        console.error('💥 [ExtractUrls] Fatal Error:', err);
    });
}

