import { MongoDatabase } from '../../database/mongo';
import Redis from 'ioredis';

export class GeekNewsRefreshUrls {
    public async run(): Promise<void> {
        console.log('🔄 [GeekNews Refresh Urls] Starting precision recovery of uncollected targets...');
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        const redis = new Redis(redisUrl);

        try {
            const bronzeGeeknews = await mongo.getCollection('bronze/geeknews.html');
            const geeknewsUrlsColl = await mongo.getCollection('bronze/geeknews.urls');

            // 1. 이미 수집 완료된 ID 목록 추출
            const completedIds = await bronzeGeeknews.distinct('id');
            console.log(`📥 Loaded ${completedIds.length} already completed GeekNews IDs.`);

            // 2. 현재 Redis scrape_queue 에 존재하는 GeekNews URL 목록 추출
            const queueLength = await redis.llen('scrape_queue');
            const existingQueuePayloads = queueLength > 0 ? await redis.lrange('scrape_queue', 0, -1) : [];
            const existingQueueUrls = new Set<string>();
            for (const payloadStr of existingQueuePayloads) {
                try {
                    const payload = JSON.parse(payloadStr);
                    if (payload.site === 'geeknews' && payload.url) {
                        existingQueueUrls.add(payload.url);
                    }
                } catch (e) {
                    // Ignored if not JSON or different structure
                }
            }
            console.log(`📥 Loaded ${existingQueueUrls.size} GeekNews URLs currently in Redis scrape_queue.`);

            // 3. 미수집 잔여 타겟 선별
            const uncollectedNews = await geeknewsUrlsColl.find({
                id: { $nin: completedIds }
            }, {
                projection: { id: 1, url: 1 }
            }).toArray();

            console.log(`🔍 Found ${uncollectedNews.length} uncollected target items in database.`);

            // 4. 이미 Redis 큐에 대기 중인 URL 필터링
            const filteredJobs = uncollectedNews.filter(j => j.url && !existingQueueUrls.has(j.url));
            console.log(`💡 Filtered out ${uncollectedNews.length - filteredJobs.length} items already waiting in Redis queue.`);

            if (filteredJobs.length > 0) {
                const newsToPush = filteredJobs.filter(j => j.url);
                const idsToUpdate = filteredJobs.map(j => j.id);

                // 5. Redis scrape_queue 에 적재
                console.log(`📥 Pushing ${newsToPush.length} URLs to Redis scrape_queue...`);
                const payloads = newsToPush.map(j => JSON.stringify({
                    site: 'geeknews',
                    url: j.url,
                    attempt: 1
                }));

                const chunkSize = 1000;
                for (let i = 0; i < payloads.length; i += chunkSize) {
                    const chunk = payloads.slice(i, i + chunkSize);
                    await redis.rpush('scrape_queue', ...chunk);
                }

                // 6. MongoDB 상태를 pushedToRedis: true, status: 'new' 로 갱신
                const result = await geeknewsUrlsColl.updateMany(
                    { id: { $in: idsToUpdate } },
                    { $set: { pushedToRedis: true, status: 'new', updatedAt: new Date() } }
                );

                console.log(`✨ Recovery complete! Redis Queue Pushed: ${newsToPush.length}, MongoDB Modified Count: ${result.modifiedCount}`);
            } else {
                console.log('💡 No new uncollected target items to recover.');
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
    const refreshUrls = new GeekNewsRefreshUrls();
    refreshUrls.run().catch(console.error);
}
