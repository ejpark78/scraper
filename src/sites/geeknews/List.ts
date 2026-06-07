import * as cheerio from 'cheerio';
import Redis from 'ioredis';
import { MongoDatabase } from '../../database/mongo';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const QUEUE_KEY = 'geeknews_queue';
const CACHE_SET_KEY = 'completed_news';

export class GeekNewsList {
    private redis!: Redis;

    public async init(): Promise<void> {
        this.redis = new Redis(REDIS_URL);
        console.log(`📡 [GeekNews List] Connected to Redis for queueing.`);
    }

    public async close(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
        }
    }

    public async run(page: number = 1): Promise<number> {
        const url = page === 1 ? 'https://news.hada.io/' : `https://news.hada.io/?page=${page}`;
        console.log(`🌐 [GeekNews List] Fetching index page: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch GeekNews index. Status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const topicRows = $('.topic_row');
        console.log(`🔍 [GeekNews List] Found ${topicRows.length} topics on index page.`);

        const dbInstance = MongoDatabase.getInstance();
        const geeknewsUrlsColl = await dbInstance.getCollection('bronze/geeknews.urls');

        // Synchronize Completed cache with MongoDB first if Redis cache is empty
        const completedCount = await this.redis.scard(CACHE_SET_KEY);
        if (completedCount === 0) {
            try {
                console.log(`🔍 [GeekNews List] Redis cache is empty. Seeding from MongoDB bronze.geeknews...`);
                const bronzeGeeknews = await dbInstance.getCollection('bronze/geeknews.html');
                const existing = await bronzeGeeknews.find({}, { projection: { id: 1, _id: 0 } }).toArray();
                if (existing.length > 0) {
                    const pipeline = this.redis.pipeline();
                    existing.forEach((doc: any) => {
                        if (doc.id) pipeline.sadd(CACHE_SET_KEY, doc.id);
                    });
                    await pipeline.exec();
                    console.log(`📡 [GeekNews List] Seeded ${existing.length} completed IDs into Redis cache.`);
                }
            } catch (err: any) {
                console.warn(`⚠️ MongoDB seed skipped or failed: ${err.message}`);
            }
        }

        let queuedCount = 0;

        for (let i = 0; i < topicRows.length; i++) {
            const row = $(topicRows[i]);
            const titleEl = row.find('.topictitle a');
            if (titleEl.length === 0) continue;

            const title = titleEl.text().trim();
            let relativeUrl = titleEl.attr('href') || '';
            if (!relativeUrl) continue;

            // GeekNews details are located at relative URLs e.g. topic?id=32402
            let detailUrl = relativeUrl.startsWith('http') 
                ? relativeUrl 
                : `https://news.hada.io/${relativeUrl.replace(/^\//, '')}`;

            // Extract ID
            let id = '';
            if (detailUrl.includes('id=')) {
                id = detailUrl.split('id=').pop()!.split('&')[0];
            }

            if (!id) continue;

            // Check if already completed
            const isCompleted = await this.redis.sismember(CACHE_SET_KEY, id);

            // Upsert URL metadata to MongoDB
            await geeknewsUrlsColl.updateOne(
                { id },
                {
                    $set: {
                        id,
                        url: detailUrl,
                        title,
                        status: isCompleted ? 'completed' : 'new',
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        pushedToRedis: isCompleted ? true : false
                    }
                },
                { upsert: true }
            );

            if (isCompleted) {
                console.log(`⏭️ [GeekNews List] Skipping already completed item: [ID: ${id}] ${title}`);
                continue;
            }

            // Check if already pushed to Redis
            const doc = await geeknewsUrlsColl.findOne({ id });
            const alreadyPushed = doc?.pushedToRedis || false;

            if (!alreadyPushed) {
                // Push to Redis Queue
                await this.redis.rpush(QUEUE_KEY, detailUrl);
                await geeknewsUrlsColl.updateOne(
                    { id },
                    { $set: { pushedToRedis: true } }
                );
                console.log(`🚀 [GeekNews List] Queued: [ID: ${id}] ${title} -> ${detailUrl}`);
                queuedCount++;
            }
        }

        console.log(`🎉 [GeekNews List] Successfully queued ${queuedCount} items.`);
        return queuedCount;
    }
}

if (require.main === module) {
    (async () => {
        const list = new GeekNewsList();
        try {
            await list.init();
            const page = process.argv[2] ? parseInt(process.argv[2]) : 1;
            await list.run(page);
        } catch (e: any) {
            console.error(`❌ List failed: ${e.message}`);
        } finally {
            await list.close();
        }
    })();
}
