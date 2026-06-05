import Redis from 'ioredis';
import { MongoDatabase } from '../../database/mongo';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const QUEUE_KEY = 'pytorch_kr_queue';
const CACHE_SET_KEY = 'completed_news';

export class PyTorchKRList {
    private redis!: Redis;

    public async init(): Promise<void> {
        this.redis = new Redis(REDIS_URL);
        console.log(`📡 [PyTorch KR List] Connected to Redis for queueing.`);
    }

    public async close(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
        }
    }

    public async run(page: number = 1): Promise<number> {
        const url = `https://discuss.pytorch.kr/latest.json?no_definitions=true&page=${page}`;
        console.log(`🌐 [PyTorch KR List] Fetching index JSON: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch PyTorch KR index. Status: ${response.status}`);
        }

        const data = await response.json();
        const topics = data.topic_list?.topics || [];
        console.log(`🔍 [PyTorch KR List] Found ${topics.length} topics on index page.`);

        const dbInstance = MongoDatabase.getInstance();
        const pytorchUrlsColl = await dbInstance.getCollection('bronze.pytorch_kr_urls');

        // Synchronize Completed cache with MongoDB first if Redis cache is empty
        const completedCount = await this.redis.scard(CACHE_SET_KEY);
        if (completedCount === 0) {
            try {
                console.log(`🔍 [PyTorch KR List] Redis cache is empty. Seeding from MongoDB bronze.pytorch_kr...`);
                const bronzePytorch = await dbInstance.getCollection('bronze.pytorch_kr');
                const existing = await bronzePytorch.find({}, { projection: { id: 1, _id: 0 } }).toArray();
                if (existing.length > 0) {
                    const pipeline = this.redis.pipeline();
                    existing.forEach((doc: any) => {
                        if (doc.id) pipeline.sadd(CACHE_SET_KEY, doc.id);
                    });
                    await pipeline.exec();
                    console.log(`📡 [PyTorch KR List] Seeded ${existing.length} completed IDs into Redis cache.`);
                }
            } catch (err: any) {
                console.warn(`⚠️ MongoDB seed skipped or failed: ${err.message}`);
            }
        }

        let queuedCount = 0;

        for (const topic of topics) {
            const id = String(topic.id);
            const slug = topic.slug;
            const title = topic.title;

            if (!id || !slug) continue;

            const detailUrl = `https://discuss.pytorch.kr/t/${slug}/${id}`;

            // Check if already completed
            const isCompleted = await this.redis.sismember(CACHE_SET_KEY, id);

            // Upsert URL metadata to MongoDB
            await pytorchUrlsColl.updateOne(
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
                console.log(`⏭️ [PyTorch KR List] Skipping already completed item: [ID: ${id}] ${title}`);
                continue;
            }

            // Check if already pushed to Redis
            const doc = await pytorchUrlsColl.findOne({ id });
            const alreadyPushed = doc?.pushedToRedis || false;

            if (!alreadyPushed) {
                // Push to Redis Queue
                await this.redis.rpush(QUEUE_KEY, detailUrl);
                await pytorchUrlsColl.updateOne(
                    { id },
                    { $set: { pushedToRedis: true } }
                );
                console.log(`🚀 [PyTorch KR List] Queued: [ID: ${id}] ${title} -> ${detailUrl}`);
                queuedCount++;
            }
        }

        console.log(`🎉 [PyTorch KR List] Successfully queued ${queuedCount} items.`);
        return queuedCount;
    }
}

if (require.main === module) {
    (async () => {
        const list = new PyTorchKRList();
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
