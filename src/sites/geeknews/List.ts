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
        let url = 'https://news.hada.io/';
        if (page > 1) {
            url = page <= 5 ? `https://news.hada.io/?page=${page}` : `https://news.hada.io/past?page=${page}`;
        }
        
        const sleepSec = parseInt(process.env.SLACK_TIME || '3', 10);
        if (sleepSec > 0) {
            console.log(`💤 [대기] GeekNews 목록 수집 전 ${sleepSec}초 대기 중...`);
            await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
        }

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

            // Find GeekNews topic URL (e.g. topic?id=32402) from the comments or info section
            let topicUrl = '';
            const commentLinkEl = row.find('a[href^="topic?id="], a[href*="topic?id="]');
            if (commentLinkEl.length > 0) {
                topicUrl = commentLinkEl.first().attr('href') || '';
            } else if (relativeUrl.includes('topic?id=')) {
                topicUrl = relativeUrl;
            }

            if (!topicUrl) continue;

            let detailUrl = `https://news.hada.io/${topicUrl.replace(/^\//, '')}`;

            // Extract ID from topicUrl
            let id = '';
            const match = topicUrl.match(/id=(\d+)/);
            if (match) {
                id = match[1];
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
                // Read SCRAPER_SLACK environment variable
                const scraperSlackVal = process.env.SCRAPER_SLACK ? parseInt(process.env.SCRAPER_SLACK, 10) : 0;
                
                // Push to Redis Queue (Unified scrape_queue with priority format)
                const payload = JSON.stringify({
                    site: 'geeknews',
                    url: detailUrl,
                    attempt: 1,
                    priority: 'medium',
                    ...(scraperSlackVal > 0 ? { scraperSlack: scraperSlackVal } : {})
                });
                await this.redis.rpush('scrape_queue:geeknews:medium', payload);
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
            const arg = process.argv[2] || '1';
            
            if (arg.includes('-')) {
                const [startStr, endStr] = arg.split('-');
                const start = parseInt(startStr, 10) || 1;
                const end = parseInt(endStr, 10) || start;
                console.log(`🚀 [GeekNews List] Running page range: ${start} to ${end}`);
                
                for (let p = start; p <= end; p++) {
                    console.log(`\n📄 [GeekNews List] Processing page ${p}/${end}...`);
                    await list.run(p);
                }
            } else {
                const page = parseInt(arg, 10) || 1;
                await list.run(page);
            }
        } catch (e: any) {
            console.error(`❌ List failed: ${e.message}`);
        } finally {
            await list.close();
        }
    })();
}
