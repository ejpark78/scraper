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
        try {
            await MongoDatabase.getInstance().close();
        } catch (err: any) {
            console.warn(`⚠️ Error closing MongoDB connection: ${err.message}`);
        }
    }

    public async run(page: number = 1): Promise<number> {
        const sleepSec = parseInt(process.env.SLACK_TIME || '3', 10);
        if (sleepSec > 0) {
            console.log(`💤 [대기] PyTorch KR 목록 수집 전 ${sleepSec}초 대기 중...`);
            await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
        }

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

        // Raw list parsing begins

        const topics = data.topic_list?.topics || [];
        console.log(`🔍 [PyTorch KR List] Found ${topics.length} topics on index page.`);

        const dbInstance = MongoDatabase.getInstance();
        const pytorchUrlsColl = await dbInstance.getCollection('bronze/pytorch_kr.urls');

        // Synchronize Completed cache with MongoDB first if Redis cache is empty
        const completedCount = await this.redis.scard(CACHE_SET_KEY);
        if (completedCount === 0) {
            try {
                console.log(`🔍 [PyTorch KR List] Redis cache is empty. Seeding from MongoDB bronze.pytorch_kr...`);
                const bronzePytorch = await dbInstance.getCollection('bronze/pytorch_kr.html');
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

        const overwrite = process.env.OVERWRITE === 'true';
        let queuedCount = 0;

        for (const topic of topics) {
            const id = String(topic.id);
            const slug = topic.slug;
            const title = topic.title;

            if (!id || !slug) continue;

            // OVERWRITE 기능 지원: 강제 덮어쓰기 시 Redis 캐시 및 MongoDB 내 플래그 초기화
            if (overwrite) {
                await this.redis.srem(CACHE_SET_KEY, id);
            }

            // 💾 MongoDB bronze/pytorch_kr.lists (개별 토픽 목록 정보) 저장 추가
            try {
                const pytorchListsColl = await dbInstance.getCollection('bronze/pytorch_kr.lists');
                const cleanTopic = { ...topic };
                delete (cleanTopic as any)._id; // _id 충돌 방지
                await pytorchListsColl.updateOne(
                    { _id: `${slug}_${id}` },
                    {
                        $set: {
                            ...cleanTopic,
                            collectedAt: new Date()
                        }
                    },
                    { upsert: true }
                );
            } catch (dbErr: any) {
                console.error(`⚠️ Failed to save topic list snapshot to MongoDB: ${dbErr.message}`);
            }

            const detailUrl = `https://discuss.pytorch.kr/t/${slug}/${id}`;

            // Check if already completed
            const isCompleted = overwrite ? false : await this.redis.sismember(CACHE_SET_KEY, id);

            // Upsert URL metadata to MongoDB
            const updateDoc: any = {
                $set: {
                    id,
                    url: detailUrl,
                    title,
                    status: isCompleted ? 'completed' : 'new',
                    updatedAt: new Date()
                }
            };

            if (overwrite) {
                // OVERWRITE 인 경우, 기존 pushedToRedis 플래그도 false로 강제 설정하여 큐 적재가 가능하도록 유도
                updateDoc.$set.pushedToRedis = false;
            } else {
                updateDoc.$setOnInsert = {
                    pushedToRedis: isCompleted ? true : false
                };
            }

            await pytorchUrlsColl.updateOne({ id }, updateDoc, { upsert: true });

            if (isCompleted) {
                console.log(`⏭️ [PyTorch KR List] Skipping already completed item: [ID: ${id}] ${title}`);
                continue;
            }

            // Check if already pushed to Redis
            const doc = await pytorchUrlsColl.findOne({ id });
            const alreadyPushed = doc?.pushedToRedis || false;

            if (!alreadyPushed) {
                const priority = process.env.PRIORITY || 'medium';
                // Read SCRAPER_SLACK environment variable
                const scraperSlackVal = process.env.SCRAPER_SLACK ? parseInt(process.env.SCRAPER_SLACK, 10) : 0;

                // Push to Redis Queue (Unified scrape_queue with priority format)
                const payload = JSON.stringify({
                    site: 'pytorch_kr',
                    url: detailUrl,
                    attempt: 1,
                    priority: priority,
                    ...(scraperSlackVal > 0 ? { scraperSlack: scraperSlackVal } : {})
                });
                await this.redis.rpush(`scrape_queue:pytorch_kr:${priority}`, payload);
                await pytorchUrlsColl.updateOne(
                    { id },
                    { $set: { pushedToRedis: true } }
                );
                console.log(`🚀 [PyTorch KR List] Queued (Force Overwrite: ${overwrite}): [ID: ${id}] ${title} -> ${detailUrl}`);
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
            const arg = process.argv[2] || '1';
            
            if (arg.includes('-')) {
                const [startStr, endStr] = arg.split('-');
                const start = parseInt(startStr, 10) || 1;
                const end = parseInt(endStr, 10) || start;
                console.log(`🚀 [PyTorch KR List] Running page range: ${start} to ${end}`);
                
                for (let p = start; p <= end; p++) {
                    console.log(`\n📄 [PyTorch KR List] Processing page ${p}/${end}...`);
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
