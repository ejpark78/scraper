import { MongoDatabase } from '../../database/mongo';
import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';

async function main() {
    console.log('🔄 [Fix Queue] Starting precision recovery of uncollected targets...');
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const redis = new Redis(redisUrl);

    try {
        const bronzeJobs = await mongo.getCollection('bronze.jobs');
        const jobUrlsColl = await mongo.getCollection('bronze.job_urls');

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
                const configPath = path.join(__dirname, '..', '..', 'config', 'config.json');
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

        // 3. 현재 Redis jobs_queue 에 존재하는 URL 목록 추출
        const queueLength = await redis.llen('jobs_queue');
        const existingQueueUrls = queueLength > 0 ? await redis.lrange('jobs_queue', 0, -1) : [];
        const existingQueueSet = new Set(existingQueueUrls);
        console.log(`📥 Loaded ${existingQueueSet.size} URLs currently in Redis jobs_queue.`);

        // 4. 미수집 잔여 타겟 선별 (pushedToRedis 값에 상관없이, 완료되지 않은 대상 전체를 발굴)
        const uncollectedJobs = await jobUrlsColl.find({
            jobId: { $nin: completedIds },
            geo: { $in: targetLocations }
        }, {
            projection: { jobId: 1, url: 1 }
        }).toArray();

        console.log(`🔍 Found ${uncollectedJobs.length} uncollected target jobs in database.`);

        // 5. 이미 Redis 큐에 대기 중인 URL 필터링
        const filteredJobs = uncollectedJobs.filter(j => j.url && !existingQueueSet.has(j.url));
        console.log(`💡 Filtered out ${uncollectedJobs.length - filteredJobs.length} jobs already waiting in Redis queue.`);

        if (filteredJobs.length > 0) {
            const urlsToPush = filteredJobs.map(j => j.url).filter(Boolean);
            const jobIdsToUpdate = filteredJobs.map(j => j.jobId);

            // 6. Redis jobs_queue 에 적재
            console.log(`📥 Pushing ${urlsToPush.length} URLs to Redis jobs_queue...`);
            const chunkSize = 1000;
            for (let i = 0; i < urlsToPush.length; i += chunkSize) {
                const chunk = urlsToPush.slice(i, i + chunkSize);
                await redis.rpush('jobs_queue', ...chunk);
            }

            // 7. MongoDB 상태를 pushedToRedis: true, status: 'new' 로 갱신
            const result = await jobUrlsColl.updateMany(
                { jobId: { $in: jobIdsToUpdate } },
                { $set: { pushedToRedis: true, status: 'new', updatedAt: new Date() } }
            );

            console.log(`✨ Recovery complete! Redis Queue Pushed: ${urlsToPush.length}, MongoDB Modified Count: ${result.modifiedCount}`);
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

main().catch(console.error);


