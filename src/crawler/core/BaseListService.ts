import Redis from 'ioredis';
import { MongoDatabase } from '../../database/mongo';

export interface BaseListConfig {
    site: string;
    displayName: string;
    cacheSetKey: string;
    bronzeHtmlCollection: `bronze/${string}`;
    urlsCollection: `bronze/${string}`;
}

export abstract class BaseListService {
    protected redis!: Redis;
    protected config: BaseListConfig;

    constructor(config: BaseListConfig) {
        this.config = config;
    }

    async init(): Promise<void> {
        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        this.redis = new Redis(redisUrl);
        console.log(`📡 [${this.config.displayName} List] Connected to Redis for queueing.`);
    }

    async close(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
        }
        try {
            await MongoDatabase.getInstance().close();
        } catch (err: any) {
            console.warn(`⚠️ Error closing MongoDB connection: ${err.message}`);
        }
    }

    async seedCache(): Promise<void> {
        const completedCount = await this.redis.scard(this.config.cacheSetKey);
        if (completedCount === 0) {
            try {
                console.log(`🔍 [${this.config.displayName} List] Redis cache is empty. Seeding from MongoDB...`);
                const db = MongoDatabase.getInstance();
                const bronzeColl = await db.getCollection(this.config.bronzeHtmlCollection);
                const existing = await bronzeColl.find({}, { projection: { id: 1, _id: 0 } }).toArray();
                if (existing.length > 0) {
                    const pipeline = this.redis.pipeline();
                    existing.forEach((doc: any) => {
                        if (doc.id) pipeline.sadd(this.config.cacheSetKey, doc.id);
                    });
                    await pipeline.exec();
                    console.log(`📡 [${this.config.displayName} List] Seeded ${existing.length} completed IDs into Redis cache.`);
                }
            } catch (err: any) {
                console.warn(`⚠️ MongoDB seed skipped or failed: ${err.message}`);
            }
        }
    }

    async processItem(id: string, url: string, title: string, extras?: Record<string, any>): Promise<boolean> {
        const { site, displayName, cacheSetKey, urlsCollection } = this.config;
        const overwrite = process.env.OVERWRITE === 'true';

        if (overwrite) {
            await this.redis.srem(cacheSetKey, id);
        }
        const isCompleted = overwrite ? false : await this.redis.sismember(cacheSetKey, id);

        const db = MongoDatabase.getInstance();
        const urlsColl = await db.getCollection(urlsCollection);

        const updateDoc: any = {
            $set: {
                id,
                url,
                title,
                status: isCompleted ? 'completed' : 'new',
                updatedAt: new Date(),
                ...(extras || {}),
            }
        };

        if (overwrite) {
            updateDoc.$set.pushedToRedis = false;
        } else {
            updateDoc.$setOnInsert = { pushedToRedis: isCompleted ? true : false };
        }

        await urlsColl.updateOne({ id }, updateDoc, { upsert: true });

        if (isCompleted) {
            console.log(`⏭️ [${displayName} List] Skipping already completed item: [ID: ${id}] ${title}`);
            return false;
        }

        const doc = await urlsColl.findOne({ id });
        const alreadyPushed = doc?.pushedToRedis || false;

        if (!alreadyPushed) {
            const priority = process.env.PRIORITY || 'medium';
            const scraperSlackVal = process.env.SCRAPER_SLACK ? parseInt(process.env.SCRAPER_SLACK, 10) : 0;

            const payload: Record<string, any> = {
                site,
                url,
                attempt: 1,
                priority,
                recursive: process.env.RECURSIVE_SCRAPE === 'true',
            };
            if (scraperSlackVal > 0) {
                payload.scraperSlack = scraperSlackVal;
            }

            await this.redis.rpush(`scrape_queue:${site}:${priority}`, JSON.stringify(payload));
            await urlsColl.updateOne({ id }, { $set: { pushedToRedis: true } });
            console.log(`🚀 [${displayName} List] Queued (Force Overwrite: ${overwrite}): [ID: ${id}] ${title} -> ${url}`);
            return true;
        }

        return false;
    }

    abstract run(page?: number): Promise<number>;
}
