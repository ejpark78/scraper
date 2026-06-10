import { MongoDatabase } from '../../database/mongo';
import Redis from 'ioredis';

export interface RefreshUrlsConfig {
    site: string;
    displayName: string;
    cacheSetKey: string;
    legacyQueue?: boolean;
}

export class BaseRefreshUrls {
    constructor(protected config: RefreshUrlsConfig) {}

    public async run(): Promise<void> {
        const { site, displayName, cacheSetKey, legacyQueue } = this.config;
        const bronzeHtmlCollection: `bronze/${string}` = `bronze/${site}.html`;
        const urlsCollection: `bronze/${string}` = `bronze/${site}.urls`;

        console.log(`🔄 [${displayName} Refresh Urls] Starting precision recovery of uncollected targets...`);
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        const redis = new Redis(redisUrl);

        try {
            const bronzeHtml = await mongo.getCollection(bronzeHtmlCollection);
            const urlsColl = await mongo.getCollection(urlsCollection);

            const completedIds = await bronzeHtml.distinct('id');
            console.log(`📥 Loaded ${completedIds.length} already completed ${displayName} IDs.`);

            const priority = process.env.PRIORITY || 'medium';
            const perSiteQueueKey = `scrape_queue:${site}:${priority}`;
            const existingQueueUrls = new Set<string>();

            if (legacyQueue) {
                const legacyQueueLen = await redis.llen('scrape_queue');
                if (legacyQueueLen > 0) {
                    const legacyPayloads = await redis.lrange('scrape_queue', 0, -1);
                    for (const p of legacyPayloads) {
                        try {
                            const payload = JSON.parse(p);
                            if (payload.site === site && payload.url) {
                                existingQueueUrls.add(payload.url);
                            }
                        } catch {}
                    }
                }
                console.log(`📥 Loaded ${existingQueueUrls.size} ${displayName} URLs currently in Redis scrape_queue.`);
            } else {
                const queueLen = await redis.llen(perSiteQueueKey);
                if (queueLen > 0) {
                    const payloads = await redis.lrange(perSiteQueueKey, 0, -1);
                    for (const p of payloads) {
                        try {
                            const payload = JSON.parse(p);
                            if (payload.url) {
                                existingQueueUrls.add(payload.url);
                            }
                        } catch {}
                    }
                }
                console.log(`📥 Loaded ${existingQueueUrls.size} ${displayName} URLs currently in Redis queue.`);
            }

            const overwrite = process.env.OVERWRITE === 'true';
            const query = overwrite ? {} : { id: { $nin: completedIds } };
            const targets = await urlsColl.find(query, { projection: { id: 1, url: 1 } }).toArray();
            console.log(`🔍 Found ${targets.length} target items in database${overwrite ? ' (OVERWRITE mode)' : ''}.`);

            const filteredJobs = targets.filter(j => j.url && (overwrite || !existingQueueUrls.has(j.url)));
            console.log(`💡 Filtered out ${targets.length - filteredJobs.length} items already waiting in Redis queue.`);

            if (filteredJobs.length > 0) {
                const idsToUpdate = filteredJobs.map(j => j.id);

                if (overwrite) {
                    for (const id of idsToUpdate) {
                        await redis.srem(cacheSetKey, id);
                    }
                }

                console.log(`📥 Pushing ${filteredJobs.length} URLs to Redis queue...`);
                const payloads = filteredJobs.map(j => JSON.stringify({
                    site,
                    url: j.url,
                    attempt: 1,
                    priority
                }));

                const chunkSize = 1000;
                for (let i = 0; i < payloads.length; i += chunkSize) {
                    const chunk = payloads.slice(i, i + chunkSize);
                    await redis.rpush(perSiteQueueKey, ...chunk);
                }

                const result = await urlsColl.updateMany(
                    { id: { $in: idsToUpdate } },
                    { $set: { pushedToRedis: true, status: 'new', updatedAt: new Date() } }
                );

                console.log(`✨ Recovery complete! Redis Queue Pushed: ${filteredJobs.length}, MongoDB Modified Count: ${result.modifiedCount}`);
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
