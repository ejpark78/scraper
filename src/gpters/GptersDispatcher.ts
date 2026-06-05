import Redis from 'ioredis';
import { MongoDatabase } from '../database/mongo';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const QUEUE_KEY = 'gpters_queue';
const CACHE_SET_KEY = 'completed_news';

export class GptersDispatcher {
    private redis!: Redis;

    public async init(): Promise<void> {
        this.redis = new Redis(REDIS_URL);
        console.log(`📡 [GPTERS Dispatcher] Connected to Redis for queueing.`);
    }

    public async close(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
        }
    }

    public async dispatch(limit: number = 20): Promise<number> {
        console.log(`🌐 [GPTERS Dispatcher] Fetching news feed via GraphQL...`);

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
        console.log(`🔍 [GPTERS Dispatcher] Found ${posts.length} posts on index.`);

        // Synchronize Completed cache with MongoDB first if Redis cache is empty
        const completedCount = await this.redis.scard(CACHE_SET_KEY);
        if (completedCount === 0) {
            try {
                console.log(`🔍 [GPTERS Dispatcher] Redis cache is empty. Seeding from MongoDB bronze.gpters...`);
                const dbInstance = MongoDatabase.getInstance();
                const bronzeGpters = await dbInstance.getCollection('bronze.gpters');
                const existing = await bronzeGpters.find({}, { projection: { id: 1, _id: 0 } }).toArray();
                if (existing.length > 0) {
                    const pipeline = this.redis.pipeline();
                    existing.forEach((doc: any) => {
                        if (doc.id) pipeline.sadd(CACHE_SET_KEY, doc.id);
                    });
                    await pipeline.exec();
                    console.log(`📡 [GPTERS Dispatcher] Seeded ${existing.length} completed IDs into Redis cache.`);
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
            if (isCompleted) {
                console.log(`⏭️ [GPTERS Dispatcher] Skipping already completed item: [ID: ${id}] ${title}`);
                continue;
            }

            // Push to Redis Queue
            await this.redis.rpush(QUEUE_KEY, detailUrl);
            console.log(`🚀 [GPTERS Dispatcher] Queued: [ID: ${id}] ${title} -> ${detailUrl}`);
            queuedCount++;
        }

        console.log(`🎉 [GPTERS Dispatcher] Successfully queued ${queuedCount} items.`);
        return queuedCount;
    }
}

if (require.main === module) {
    (async () => {
        const dispatcher = new GptersDispatcher();
        try {
            await dispatcher.init();
            const limit = process.argv[2] ? parseInt(process.argv[2]) : 20;
            await dispatcher.dispatch(limit);
        } catch (e: any) {
            console.error(`❌ Dispatcher failed: ${e.message}`);
        } finally {
            await dispatcher.close();
        }
    })();
}
