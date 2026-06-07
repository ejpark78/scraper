import Redis from 'ioredis';
import { MongoDatabase } from '../../database/mongo';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const QUEUE_KEY = 'gpters_queue';
const CACHE_SET_KEY = 'completed_news';

export class GptersList {
    private redis!: Redis;

    public async init(): Promise<void> {
        this.redis = new Redis(REDIS_URL);
        console.log(`📡 [GPTERS List] Connected to Redis for queueing.`);
    }

    public async close(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
        }
    }

    public async run(limit: number = 20): Promise<number> {
        console.log(`🌐 [GPTERS List] Fetching news feed via GraphQL...`);

        const query = `
        query getNewsFeed($spaceSlug: String!, $limit: Int!, $after: String) { 
          posts(spaceSlug: $spaceSlug, limit: $limit, after: $after) { 
            nodes {
              id 
              title 
              slug 
              createdAt 
              author { 
                name 
              } 
              reactionsCount 
              repliesCount 
              shortContent
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          } 
        }
        `;

        const response = await fetch('https://api.bettermode.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                operationName: 'getNewsFeed',
                query,
                variables: {
                    spaceSlug: 'news',
                    limit,
                    after: null
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch GPTERS index via GraphQL. Status: ${response.status}`);
        }

        const resJson = await response.json();
        const posts = resJson.data?.posts?.nodes || [];
        console.log(`🔍 [GPTERS List] Found ${posts.length} posts on index.`);

        const dbInstance = MongoDatabase.getInstance();
        const gptersUrlsColl = await dbInstance.getCollection('bronze/gpters.urls');

        // Synchronize Completed cache with MongoDB first if Redis cache is empty
        const completedCount = await this.redis.scard(CACHE_SET_KEY);
        if (completedCount === 0) {
            try {
                console.log(`🔍 [GPTERS List] Redis cache is empty. Seeding from MongoDB bronze.gpters...`);
                const bronzeGpters = await dbInstance.getCollection('bronze/gpters.html');
                const existing = await bronzeGpters.find({}, { projection: { id: 1, _id: 0 } }).toArray();
                if (existing.length > 0) {
                    const pipeline = this.redis.pipeline();
                    existing.forEach((doc: any) => {
                        if (doc.id) pipeline.sadd(CACHE_SET_KEY, doc.id);
                    });
                    await pipeline.exec();
                    console.log(`📡 [GPTERS List] Seeded ${existing.length} completed IDs into Redis cache.`);
                }
            } catch (err: any) {
                console.warn(`⚠️ MongoDB seed skipped or failed: ${err.message}`);
            }
        }

        let queuedCount = 0;

        for (const post of posts) {
            const id = post.id;
            const slug = post.slug;
            const title = post.title;

            if (!id || !slug) continue;

            // GPTERS post URL structure
            const detailUrl = `https://www.gpters.org/news/post/${slug}-${id}`;

            // Check if already completed
            const isCompleted = await this.redis.sismember(CACHE_SET_KEY, id);

            // Upsert URL metadata to MongoDB
            await gptersUrlsColl.updateOne(
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
                console.log(`⏭️ [GPTERS List] Skipping already completed item: [ID: ${id}] ${title}`);
                continue;
            }

            // Check if already pushed to Redis
            const doc = await gptersUrlsColl.findOne({ id });
            const alreadyPushed = doc?.pushedToRedis || false;

            if (!alreadyPushed) {
                // Push to Redis Queue
                await this.redis.rpush(QUEUE_KEY, detailUrl);
                await gptersUrlsColl.updateOne(
                    { id },
                    { $set: { pushedToRedis: true } }
                );
                console.log(`🚀 [GPTERS List] Queued: [ID: ${id}] ${title} -> ${detailUrl}`);
                queuedCount++;
            }
        }

        console.log(`🎉 [GPTERS List] Successfully queued ${queuedCount} items.`);
        return queuedCount;
    }
}

if (require.main === module) {
    (async () => {
        const list = new GptersList();
        try {
            await list.init();
            const limit = process.argv[2] ? parseInt(process.argv[2]) : 20;
            await list.run(limit);
        } catch (e: any) {
            console.error(`❌ List failed: ${e.message}`);
        } finally {
            await list.close();
        }
    })();
}
