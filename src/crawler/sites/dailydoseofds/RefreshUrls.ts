import { MongoDatabase } from '../../../database/mongo';
import Redis from 'ioredis';

const CACHE_SET_KEY = 'completed_ddds';

export class DailyDoseDSRefreshUrls {
    public async run(): Promise<void> {
        console.log('🔄 [Daily Dose DS Refresh Urls] Starting precision recovery of uncollected targets...');
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        const redis = new Redis(redisUrl);

        try {
            const bronzeHtml = await mongo.getCollection('bronze/dailydose_ds.html');
            const urlsColl = await mongo.getCollection('bronze/dailydose_ds.urls');

            // 1. 이미 수집 완료된 ID 목록 추출
            const completedIds = await bronzeHtml.distinct('id');
            console.log(`📥 Loaded ${completedIds.length} already completed Daily Dose DS IDs.`);

            // 2. 현재 Redis scrape_queue 에 존재하는 URL 목록 추출 (사이트별 큐)
            const priority = process.env.PRIORITY || 'medium';
            const queueKey = `scrape_queue:dailydose_ds:${priority}`;
            const queueLength = await redis.llen(queueKey);
            const existingQueuePayloads = queueLength > 0 ? await redis.lrange(queueKey, 0, -1) : [];
            const existingQueueUrls = new Set<string>();
            for (const payloadStr of existingQueuePayloads) {
                try {
                    const payload = JSON.parse(payloadStr);
                    if (payload.url) {
                        existingQueueUrls.add(payload.url);
                    }
                } catch (e) {
                    // Ignored
                }
            }
            console.log(`📥 Loaded ${existingQueueUrls.size} Daily Dose DS URLs currently in Redis queue.`);

            // 3. 타겟 선별
            const overwrite = process.env.OVERWRITE === 'true';
            const query = overwrite ? {} : { id: { $nin: completedIds } };
            const targets = await urlsColl.find(query, { projection: { id: 1, url: 1 } }).toArray();
            console.log(`🔍 Found ${targets.length} target items in database${overwrite ? ' (OVERWRITE mode)' : ''}.`);

            // 4. 큐 중복 필터링
            const filteredJobs = targets.filter(j => j.url && (overwrite || !existingQueueUrls.has(j.url)));
            console.log(`💡 Filtered out ${targets.length - filteredJobs.length} items already waiting in Redis queue.`);

            if (filteredJobs.length > 0) {
                const newsToPush = filteredJobs.filter(j => j.url);
                const idsToUpdate = filteredJobs.map(j => j.id);

                if (overwrite) {
                    for (const id of idsToUpdate) {
                        await redis.srem(CACHE_SET_KEY, id);
                    }
                }

                console.log(`📥 Pushing ${newsToPush.length} URLs to Redis queue...`);
                const payloads = newsToPush.map(j => JSON.stringify({
                    site: 'dailydose_ds',
                    url: j.url,
                    attempt: 1,
                    priority: priority
                }));

                const chunkSize = 1000;
                for (let i = 0; i < payloads.length; i += chunkSize) {
                    const chunk = payloads.slice(i, i + chunkSize);
                    await redis.rpush(queueKey, ...chunk);
                }

                const result = await urlsColl.updateMany(
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
    const refreshUrls = new DailyDoseDSRefreshUrls();
    refreshUrls.run().catch(console.error);
}
