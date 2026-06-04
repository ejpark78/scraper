import { MongoDatabase } from '../database/mongo';
import { UrlUtils } from '../utils';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    console.log('🏁 [Backfill] Starting comprehensive backfill from bronze.jobs and bronze.lists...');
    const mongo = MongoDatabase.getInstance();
    const db = await mongo.connect();
    const bronzeJobs = await mongo.getCollection('bronze.jobs');
    const bronzeLists = await mongo.getCollection('bronze.lists');
    const jobUrlsColl = await mongo.getCollection('bronze.job_urls');
    const companyUrlsColl = await mongo.getCollection('bronze.company_urls');

    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
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
    console.log('🎯 Target locations:', targetLocations);

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
    console.log(`🔌 Loaded ${completedCache.size} completed jobs as cache.`);

    // 4. 이미 큐에 주입된/대기중인 URLs 목록 로드
    const pushedUrls = new Set<string>();
    const pushedDocs = await jobUrlsColl.find({}, { projection: { jobId: 1, pushedToRedis: 1, _id: 0 } }).toArray();
    pushedDocs.forEach((d: any) => {
        if (d.jobId && d.pushedToRedis) pushedUrls.add(d.jobId);
    });
    console.log(`🔌 Loaded ${pushedUrls.size} already pushed job IDs from database.`);

    const cheerio = require('cheerio');
    const jobOps: any[] = [];
    const redisPushBuffer: string[] = [];

    // ==========================================
    // 5-A. Scan bronze.lists (Search results list HTML)
    // ==========================================
    console.log('\n🔍 [Phase 1/2] Processing search lists from bronze.lists...');
    const listCursor = bronzeLists.find({}, { projection: { listId: 1, rawHtml: 1 } });
    let listsProcessed = 0;
    let listJobsFound = 0;

    const companyHrefRegex = /href="([^"]*\/comp(?:any|ay)\/[^"]*)"/g;

    while (await listCursor.hasNext()) {
        const doc = await listCursor.next();
        if (!doc) continue;

        listsProcessed++;
        const htmlContent = doc.rawHtml || '';
        const $ = cheerio.load(htmlContent);

        // Extract job links
        $('a[href*="/jobs/view/"]').each((_: any, el: any) => {
            const href = $(el).attr('href') || '';
            const jobId = UrlUtils.extractJobId(href);
            if (!jobId || !/^\d+$/.test(jobId)) return;

            if (completedCache.has(jobId) || pushedUrls.has(jobId)) return;

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
                listJobsFound++;
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
                                pushedToRedis: true,
                                updatedAt: new Date()
                            }
                        },
                        upsert: true
                    }
                });
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

        if (listsProcessed % 100 === 0) {
            console.log(`⏳ Lists Progress: Checked ${listsProcessed} list html files... (Found: ${listJobsFound})`);
        }
    }
    console.log(`✅ [Phase 1/2] Finished: Checked ${listsProcessed} list html files. Found ${listJobsFound} target jobs.`);

    // ==========================================
    // 5-B. Scan bronze.jobs (Detail HTML)
    // ==========================================
    console.log('\n🔍 [Phase 2/2] Processing recommended jobs from bronze.jobs...');
    const jobCursor = bronzeJobs.find({}, { projection: { jobId: 1, rawHtml: 1 } });
    let jobsProcessed = 0;
    let recJobsFound = 0;

    while (await jobCursor.hasNext()) {
        const doc = await jobCursor.next();
        if (!doc) continue;

        jobsProcessed++;
        const htmlContent = doc.rawHtml || '';
        const $ = cheerio.load(htmlContent);

        $('a[href*="/jobs/view/"]').each((_: any, el: any) => {
            const href = $(el).attr('href') || '';
            const jobId = UrlUtils.extractJobId(href);
            if (!jobId || !/^\d+$/.test(jobId)) return;

            if (completedCache.has(jobId) || pushedUrls.has(jobId)) return;

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
                recJobsFound++;
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
                                pushedToRedis: true,
                                updatedAt: new Date()
                            }
                        },
                        upsert: true
                    }
                });
                redisPushBuffer.push(jobUrl);
            }
        });

        if (jobsProcessed % 500 === 0) {
            console.log(`⏳ Jobs Progress: Checked ${jobsProcessed} detail html files... (Found: ${recJobsFound})`);
        }
    }
    console.log(`✅ [Phase 2/2] Finished: Checked ${jobsProcessed} detail html files. Found ${recJobsFound} target recommended jobs.`);

    // ==========================================
    // 6. DB 저장 및 Redis 큐 적재
    // ==========================================
    const totalFound = listJobsFound + recJobsFound;
    console.log(`\n📊 Comprehensive Backfill Summary:`);
    console.log(`- Total new target jobs found: ${totalFound}`);

    if (jobOps.length > 0) {
        console.log(`📥 Saving ${jobOps.length} entries to bronze.job_urls in MongoDB...`);
        const chunkSize = 1000;
        for (let i = 0; i < jobOps.length; i += chunkSize) {
            const chunk = jobOps.slice(i, i + chunkSize);
            await jobUrlsColl.bulkWrite(chunk);
        }
        console.log('✅ bronze.job_urls updated.');
    }

    if (redisPushBuffer.length > 0) {
        console.log(`📥 Pushing ${redisPushBuffer.length} URLs to Redis jobs_queue...`);
        const chunkSize = 1000;
        for (let i = 0; i < redisPushBuffer.length; i += chunkSize) {
            const chunk = redisPushBuffer.slice(i, i + chunkSize);
            await redis.rpush('jobs_queue', ...chunk);
        }
        console.log('✅ Redis jobs_queue updated.');
    }

    await redis.quit();
    await mongo.close();
    console.log('🎉 [Comprehensive Backfill] Complete!');
}

main().catch(err => {
    console.error('💥 [Comprehensive Backfill] Fatal Error:', err);
});
