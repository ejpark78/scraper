import Redis from 'ioredis';
import { MongoDatabase } from '../../../database/mongo';
import * as cheerio from 'cheerio';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const CACHE_SET_KEY = 'completed_ddds';

export class DailyDoseDSList {
    private redis!: Redis;

    public async init(): Promise<void> {
        this.redis = new Redis(REDIS_URL);
        console.log(`📡 [Daily Dose DS List] Connected to Redis for queueing.`);
    }

    public async close(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
        }
        try {
            await MongoDatabase.getInstance().close();
        } catch (err: any) {
            console.warn(`⚠️ Error closing MongoDB connection: ${err.message}`);
        }
    }

    public async run(maxPages: number = 1): Promise<number> {
        const pageStr = process.env.PAGE || '1';
        let maxPage = 1;
        if (pageStr.includes('-')) {
            const [start, end] = pageStr.split('-').map(Number);
            maxPage = end;
        } else {
            maxPage = parseInt(pageStr, 10);
        }
        const sleepSec = parseInt(process.env.SLACK_TIME || '3', 10);
        const overwrite = process.env.OVERWRITE === 'true';
        
        const dbInstance = MongoDatabase.getInstance();
        const urlsColl = await dbInstance.getCollection('bronze/dailydose_ds.urls');

        // Seed Redis cache from MongoDB
        const completedCount = await this.redis.scard(CACHE_SET_KEY);
        if (completedCount === 0) {
            try {
                console.log(`🔍 [Daily Dose DS List] Redis cache is empty. Seeding from MongoDB...`);
                const bronzeColl = await dbInstance.getCollection('bronze/dailydose_ds.html');
                const existing = await bronzeColl.find({}, { projection: { id: 1, _id: 0 } }).toArray();
                if (existing.length > 0) {
                    const pipeline = this.redis.pipeline();
                    existing.forEach((doc: any) => {
                        if (doc.id) pipeline.sadd(CACHE_SET_KEY, doc.id);
                    });
                    await pipeline.exec();
                    console.log(`📡 [Daily Dose DS List] Seeded ${existing.length} completed IDs into Redis cache.`);
                }
            } catch (err: any) {
                console.warn(`⚠️ MongoDB seed skipped or failed: ${err.message}`);
            }
        }

        let queuedCount = 0;
        
        for (let p = 1; p <= maxPage; p++) {
            const fetchUrl = p === 1 ? `https://www.dailydoseofds.com/archive/` : `https://www.dailydoseofds.com/archive/page/${p}/`;
            console.log(`🌐 [Daily Dose DS List] Fetching page ${p}: ${fetchUrl}`);
            
            const res = await fetch(fetchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                }
            });

            if (!res.ok) {
                console.log(`⚠️ Page ${p} not found or error. Stopping.`);
                break;
            }
            
            const html = await res.text();
            const $ = cheerio.load(html);
            const articles = $('article').toArray();
            
            if (articles.length === 0) {
                console.log(`🏁 [Daily Dose DS List] No more articles found on page ${p}.`);
                break;
            }

            console.log(`🔍 [Daily Dose DS List] Found ${articles.length} articles on page ${p}.`);

            for (const art of articles) {
                const $art = $(art);
                const linkEl = $art.find('a').first();
                const url = linkEl.attr('href');
                const title = $art.find('h2').first().text().trim();
                const dateStr = $art.find('time').first().attr('datetime');

                if (!url || !title) continue;

                const id = Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
                
                if (overwrite) {
                    await this.redis.srem(CACHE_SET_KEY, id);
                }

                const isCompleted = overwrite ? false : await this.redis.sismember(CACHE_SET_KEY, id);
                
                const updateDoc: any = {
                    $set: {
                        id,
                        url,
                        title,
                        publishedAt: dateStr,
                        status: isCompleted ? 'completed' : 'new',
                        updatedAt: new Date()
                    }
                };

                if (overwrite) {
                    updateDoc.$set.pushedToRedis = false;
                } else {
                    updateDoc.$setOnInsert = { pushedToRedis: isCompleted ? true : false };
                }

                await urlsColl.updateOne({ id }, updateDoc, { upsert: true });

                if (isCompleted) {
                    console.log(`⏭️ [Daily Dose DS List] Skipping already completed: [ID: ${id}] ${title}`);
                    continue;
                }

                const doc = await urlsColl.findOne({ id });
                const alreadyPushed = doc?.pushedToRedis || false;

                if (!alreadyPushed) {
                    const priority = process.env.PRIORITY || 'medium';
                    const payload = JSON.stringify({
                        site: 'dailydose_ds',
                        url,
                        attempt: 1,
                        priority: priority
                    });
                    await this.redis.rpush(`scrape_queue:dailydose_ds:${priority}`, payload);
                    await urlsColl.updateOne({ id }, { $set: { pushedToRedis: true } });
                    console.log(`🚀 [Daily Dose DS List] Queued: ${title} -> ${url}`);
                    queuedCount++;
                }
            }
            
            if (p < maxPage) {
                await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
            }
        }

        console.log(`🎉 [Daily Dose DS List] Successfully queued ${queuedCount} items.`);
        return queuedCount;
    }
}

if (require.main === module) {
    (async () => {
        const list = new DailyDoseDSList();
        try {
            await list.init();
            await list.run();
        } catch (e: any) {
            console.error(`❌ List failed: ${e.message}`);
        } finally {
            await list.close();
        }
    })();
}
