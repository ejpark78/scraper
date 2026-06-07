import { MongoDatabase } from '../../../database/mongo';
import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';

export class JobsRefreshUrls {
    public async run(): Promise<void> {
    console.log('🔄 [Refresh Urls] Starting precision recovery of uncollected targets...');
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const redis = new Redis(redisUrl);

    try {
        const bronzeJobs = await mongo.getCollection('bronze/linkedin.jobs');
        const jobUrlsColl = await mongo.getCollection('bronze/linkedin.job_urls');

        // 1. config/config.json 파일 또는 환경 변수 GEOS에서 타겟 국가 목록 로드
        let targetLocations = ['South Korea', 'United Arab Emirates', 'Japan'];
        
        if (process.env.GEOS) {
            // GEOS="'South Korea', 'Japan'" 또는 "South Korea, Japan" 형태 파싱 및 따옴표 제거
            targetLocations = process.env.GEOS
                .split(',')
                .map((loc: string) => loc.replace(/['"]/g, '').trim());
            console.log('📌 Overridden targets via GEOS env:', targetLocations);
        } else {
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
            } catch (e: any) {
                console.warn('⚠️  Could not load config.json, using default locations.', e.message);
            }
        }
        console.log('🎯 Target locations for recovery:', targetLocations);

        // 2. 이미 수집 완료된 Job ID 목록 추출
        const completedIds = await bronzeJobs.distinct('jobId');
        console.log(`📥 Loaded ${completedIds.length} already completed Job IDs.`);

        // 3. 현재 Redis scrape_queue 에 존재하는 URL 목록 추출
        const queueLength = await redis.llen('scrape_queue');
        const existingQueuePayloads = queueLength > 0 ? await redis.lrange('scrape_queue', 0, -1) : [];
        const existingQueueUrls = new Set<string>();
        for (const payloadStr of existingQueuePayloads) {
            try {
                const payload = JSON.parse(payloadStr);
                if (payload.url) {
                    existingQueueUrls.add(payload.url);
                }
            } catch (e) {
                // Fallback for raw string URLs
                existingQueueUrls.add(payloadStr);
            }
        }
        console.log(`📥 Loaded ${existingQueueUrls.size} URLs currently in Redis scrape_queue.`);

        // 4. 미수집 잔여 타겟 선별 (pushedToRedis 값에 상관없이, 완료되지 않은 대상 전체를 발굴)
        const uncollectedJobs = await jobUrlsColl.find({
            jobId: { $nin: completedIds },
            geo: { $in: targetLocations }
        }, {
            projection: { jobId: 1, url: 1 }
        }).toArray();

        console.log(`🔍 Found ${uncollectedJobs.length} uncollected target jobs in database.`);

        // 5. 이미 Redis 큐에 대기 중인 URL 필터링
        const filteredJobs = uncollectedJobs.filter(j => j.url && !existingQueueUrls.has(j.url));
        console.log(`💡 Filtered out ${uncollectedJobs.length - filteredJobs.length} jobs already waiting in Redis queue.`);

        if (filteredJobs.length > 0) {
            const jobsToPush = filteredJobs.filter(j => j.url);
            const jobIdsToUpdate = filteredJobs.map(j => j.jobId);

            // 6. Redis scrape_queue 에 적재
            console.log(`📥 Pushing ${jobsToPush.length} URLs to Redis scrape_queue...`);
            const payloads = jobsToPush.map(j => JSON.stringify({
                site: 'linkedin',
                url: j.url,
                attempt: 1,
                priority: 'medium'
            }));

            const chunkSize = 1000;
            for (let i = 0; i < payloads.length; i += chunkSize) {
                const chunk = payloads.slice(i, i + chunkSize);
                await redis.rpush('scrape_queue:linkedin:medium', ...chunk);
            }

            // 7. MongoDB 상태를 pushedToRedis: true, status: 'new' 로 갱신
            const result = await jobUrlsColl.updateMany(
                { jobId: { $in: jobIdsToUpdate } },
                { $set: { pushedToRedis: true, status: 'new', updatedAt: new Date() } }
            );

            console.log(`✨ Recovery complete! Redis Queue Pushed: ${jobsToPush.length}, MongoDB Modified Count: ${result.modifiedCount}`);
        } else {
            console.log('💡 No new uncollected target jobs to recover (all target jobs are either completed or already in the queue).');
        }

    } catch (err: any) {
        console.error('❌ Error during queue recovery:', err);
    } finally {
        await redis.quit();
        await mongo.close();
        process.exit(0);
    }
}
}

if (require.main === module) {
    const refreshUrls = new JobsRefreshUrls();
    refreshUrls.run().catch(console.error);
}


