import { MongoDatabase } from '../../database/mongo';
import Redis from 'ioredis';

export class GeekNewsFixQueue {
    public async run(): Promise<void> {
        console.log('🔄 [GeekNews Fix Queue] Starting precision recovery of uncollected targets...');
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        const redis = new Redis(redisUrl);

        try {
            const bronzeGeeknews = await mongo.getCollection('geeknews.html');
            const geeknewsUrlsColl = await mongo.getCollection('geeknews.urls');

            // 1. 이미 수집 완료된 ID 목록 추출
            const completedIds = await bronzeGeeknews.distinct('id');
            console.log(`📥 Loaded ${completedIds.length} already completed GeekNews IDs.`);

            // 2. 현재 Redis geeknews_queue 에 존재하는 URL 목록 추출
            const queueLength = await redis.llen('geeknews_queue');
            const existingQueueUrls = queueLength > 0 ? await redis.lrange('geeknews_queue', 0, -1) : [];
            const existingQueueSet = new Set(existingQueueUrls);
            console.log(`📥 Loaded ${existingQueueSet.size} URLs currently in Redis geeknews_queue.`);

            // 3. 미수집 잔여 타겟 선별
            const uncollectedNews = await geeknewsUrlsColl.find({
                id: { $nin: completedIds }
            }, {
                projection: { id: 1, url: 1 }
            }).toArray();

            console.log(`🔍 Found ${uncollectedNews.length} uncollected target items in database.`);

            // 4. 이미 Redis 큐에 대기 중인 URL 필터링
            const filteredJobs = uncollectedNews.filter(j => j.url && !existingQueueSet.has(j.url));
            console.log(`💡 Filtered out ${uncollectedNews.length - filteredJobs.length} items already waiting in Redis queue.`);

            if (filteredJobs.length > 0) {
                const urlsToPush = filteredJobs.map(j => j.url).filter(Boolean);
                const idsToUpdate = filteredJobs.map(j => j.id);

                // 5. Redis geeknews_queue 에 적재
                console.log(`📥 Pushing ${urlsToPush.length} URLs to Redis geeknews_queue...`);
                await redis.rpush('geeknews_queue', ...urlsToPush);

                // 6. MongoDB 상태를 pushedToRedis: true, status: 'new' 로 갱신
                const result = await geeknewsUrlsColl.updateMany(
                    { id: { $in: idsToUpdate } },
                    { $set: { pushedToRedis: true, status: 'new', updatedAt: new Date() } }
                );

                console.log(`✨ Recovery complete! Redis Queue Pushed: ${urlsToPush.length}, MongoDB Modified Count: ${result.modifiedCount}`);
            } else {
                console.log('💡 No new uncollected target items to recover.');
            }

        } catch (err: any) {
            console.error('❌ Error during queue recovery:', err);
        } finally {
            await redis.quit();
            await mongo.close();
        }
    }
}

if (require.main === module) {
    const fixQueue = new GeekNewsFixQueue();
    fixQueue.run().catch(console.error).then(() => process.exit(0));
}
