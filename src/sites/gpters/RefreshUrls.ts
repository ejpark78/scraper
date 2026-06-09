import { MongoDatabase } from '../../database/mongo';
import Redis from 'ioredis';

const CACHE_SET_KEY = 'completed_news';

export class GptersRefreshUrls {
    public async run(): Promise<void> {
        console.log('🔄 [GPTERS Refresh Urls] Starting precision recovery of uncollected targets...');
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        const redis = new Redis(redisUrl);

        try {
            const bronzeGpters = await mongo.getCollection('bronze/gpters.html');
            const gptersUrlsColl = await mongo.getCollection('bronze/gpters.urls');

            // 1. 이미 수집 완료된 ID 목록 추출
            const completedIds = await bronzeGpters.distinct('id');
            console.log(`📥 Loaded ${completedIds.length} already completed GPTERS IDs.`);

            // 2. 현재 Redis scrape_queue 에 존재하는 GPTERS URL 목록 추출
            const queueLength = await redis.llen('scrape_queue');
            const existingQueuePayloads = queueLength > 0 ? await redis.lrange('scrape_queue', 0, -1) : [];
            const existingQueueUrls = new Set<string>();
            for (const payloadStr of existingQueuePayloads) {
                try {
                    const payload = JSON.parse(payloadStr);
                    if (payload.site === 'gpters' && payload.url) {
                        existingQueueUrls.add(payload.url);
                    }
                } catch (e) {
                    // Ignored if not JSON or different structure
                }
            }
            console.log(`📥 Loaded ${existingQueueUrls.size} GPTERS URLs currently in Redis scrape_queue.`);

            // 3. 타겟 선별 (OVERWRITE=true면 전체 재수집)
            const overwrite = process.env.OVERWRITE === 'true';
            const query = overwrite ? {} : { id: { $nin: completedIds } };
            const targets = await gptersUrlsColl.find(query, {
                projection: { id: 1, url: 1 }
            }).toArray();
            console.log(`🔍 Found ${targets.length} target items in database${overwrite ? ' (OVERWRITE mode)' : ''}.`);

            // 4. 이미 Redis 큐에 대기 중인 URL 필터링
            const filteredJobs = targets.filter(j => j.url && (overwrite || !existingQueueUrls.has(j.url)));
            console.log(`💡 Filtered out ${targets.length - filteredJobs.length} items already waiting in Redis queue.`);

            if (filteredJobs.length > 0) {
                const newsToPush = filteredJobs.filter(j => j.url);
                const idsToUpdate = filteredJobs.map(j => j.id);

                // 5. Redis 캐시 초기화 (OVERWRITE 모드)
                if (overwrite) {
                    for (const id of idsToUpdate) {
                        await redis.srem(CACHE_SET_KEY, id);
                    }
                }

                // 6. Redis scrape_queue 에 적재
                console.log(`📥 Pushing ${newsToPush.length} URLs to Redis scrape_queue...`);
                const priority = process.env.PRIORITY || 'medium';
                const payloads = newsToPush.map(j => JSON.stringify({
                    site: 'gpters',
                    url: j.url,
                    attempt: 1,
                    priority: priority
                }));

                const chunkSize = 1000;
                for (let i = 0; i < payloads.length; i += chunkSize) {
                    const chunk = payloads.slice(i, i + chunkSize);
                    await redis.rpush(`scrape_queue:gpters:${priority}`, ...chunk);
                }

                // 7. MongoDB 상태를 pushedToRedis: true, status: 'new' 로 갱신
                const result = await gptersUrlsColl.updateMany(
                    { id: { $in: idsToUpdate } },
                    { $set: { pushedToRedis: true, status: 'new', updatedAt: new Date() } }
                );

                console.log(`✨ Recovery complete! Redis Queue Pushed: ${newsToPush.length}, MongoDB Modified Count: ${result.modifiedCount}`);
            } else {
                console.log('💡 No new target items to recover.');
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
    const refreshUrls = new GptersRefreshUrls();
    refreshUrls.run().catch(console.error);
}
