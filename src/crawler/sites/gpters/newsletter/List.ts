import Redis from 'ioredis';
import { MongoDatabase } from '../../../../database/mongo';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const CACHE_SET_KEY = 'completed_gpters_newsletter';

const NEWSLETTER_QUERY = `
query GetPosts($after: String, $before: String, $filterBy: [PostListFilterByInput!], $limit: Int!, $orderByString: String, $postTypeIds: [String!], $reverse: Boolean, $spaceIds: [ID!]) {
  posts(after: $after, before: $before, filterBy: $filterBy, limit: $limit, orderByString: $orderByString, postTypeIds: $postTypeIds, reverse: $reverse, spaceIds: $spaceIds) {
    nodes {
      id
      title
      slug
      createdAt
      publishedAt
      createdBy { member { name } }
      reactionsCount
      repliesCount
      shortContent
      fields { key value }
      space { id name slug }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

const NEWSLETTER_VARS = {
  filterBy: [],
  limit: 20,
  orderByString: 'publishedAt',
  postTypeIds: ['KLxSodedLeDUiTj'],
  reverse: true,
  spaceIds: ['J9vvyRmbEsRs']
};

export class GptersNewsletterList {
    private redis!: Redis;

    public async init(): Promise<void> {
        this.redis = new Redis(REDIS_URL);
        console.log(`📡 [GPTERS Newsletter List] Connected to Redis for queueing.`);
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

    private async fetchGuestToken(): Promise<string> {
        const res = await fetch('https://www.gpters.org/news');
        const html = await res.text();
        const match = html.match(/accessToken":"([^"]+)"/);
        if (!match) {
            throw new Error('Failed to extract GPTERS guest access token from homepage');
        }
        return match[1];
    }

    public async run(limit: number = 20): Promise<number> {
        const pageEnv = process.env.PAGE || '0';
        const maxPages = parseInt(pageEnv, 10) || 0;
        const slackSec = parseInt(process.env.SLACK_TIME || '3', 10);
        console.log(`🌐 [GPTERS Newsletter List] Fetching guest access token...`);
        const token = await this.fetchGuestToken();

        const dbInstance = MongoDatabase.getInstance();
        const urlsColl = await dbInstance.getCollection('bronze/gpters_newsletter.urls');

        const completedCount = await this.redis.scard(CACHE_SET_KEY);
        if (completedCount === 0) {
            try {
                console.log(`🔍 [GPTERS Newsletter List] Redis cache is empty. Seeding from MongoDB...`);
                const bronzeColl = await dbInstance.getCollection('bronze/gpters_newsletter.html');
                const existing = await bronzeColl.find({}, { projection: { id: 1, _id: 0 } }).toArray();
                if (existing.length > 0) {
                    const pipeline = this.redis.pipeline();
                    existing.forEach((doc: any) => {
                        if (doc.id) pipeline.sadd(CACHE_SET_KEY, doc.id);
                    });
                    await pipeline.exec();
                    console.log(`📡 [GPTERS Newsletter List] Seeded ${existing.length} completed IDs into Redis cache.`);
                }
            } catch (err: any) {
                console.warn(`⚠️ MongoDB seed skipped or failed: ${err.message}`);
            }
        }

        let queuedCount = 0;
        const overwrite = process.env.OVERWRITE === 'true';
        let after: string | null = null;
        let page = 0;
        let hasNextPage = true;
        let r: Response;
        let resJson: any;
        let postData: any;
        let posts: any[];
        let pageInfo: any;

        do {
            page++;
            console.log(`📄 [GPTERS Newsletter List] Fetching page ${page}${maxPages > 0 ? '/' + maxPages : ''}...`);

            const variables: any = { ...NEWSLETTER_VARS, limit, after };
            if (!after) delete variables.after;

            r = await fetch('https://api.bettermode.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    operationName: 'GetPosts',
                    query: NEWSLETTER_QUERY,
                    variables
                })
            });

            if (!r.ok) {
                const body = await r.text().catch(() => '');
                throw new Error(`Failed to fetch GPTERS newsletter index via GraphQL. Status: ${r.status}: ${body.slice(0, 200)}`);
            }

            resJson = await r.json();
            postData = resJson.data?.posts;
            posts = postData?.nodes || [];
            pageInfo = postData?.pageInfo || {};
            hasNextPage = pageInfo.hasNextPage || false;
            console.log(`🔍 [GPTERS Newsletter List] Page ${page}: ${posts.length} posts (hasNextPage: ${hasNextPage})`);

            if (posts.length === 0) {
                console.log(`📭 [GPTERS Newsletter List] No more posts, stopping early.`);
                break;
            }

            for (const post of posts) {
                const id = post.id;
                const slug = post.slug;
                const title = post.title;

                if (!id || !slug) continue;

                const detailUrl = `https://www.gpters.org/news/post/${slug}-${id}`;

                if (overwrite) {
                    await this.redis.srem(CACHE_SET_KEY, id);
                }

                const isCompleted = overwrite ? false : await this.redis.sismember(CACHE_SET_KEY, id);

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
                    updateDoc.$set.pushedToRedis = false;
                } else {
                    updateDoc.$setOnInsert = {
                        pushedToRedis: isCompleted ? true : false
                    };
                }

                await urlsColl.updateOne({ id }, updateDoc, { upsert: true });

                if (isCompleted) {
                    console.log(`⏭️ [GPTERS Newsletter List] Skipping already completed item: [ID: ${id}] ${title}`);
                    continue;
                }

                const doc = await urlsColl.findOne({ id });
                const alreadyPushed = doc?.pushedToRedis || false;

                if (!alreadyPushed) {
                    const priority = process.env.PRIORITY || 'medium';
                    const payload = JSON.stringify({
                        site: 'gpters_newsletter',
                        url: detailUrl,
                        attempt: 1,
                        priority: priority
                    });
                    await this.redis.rpush(`scrape_queue:gpters_newsletter:${priority}`, payload);
                    await urlsColl.updateOne(
                        { id },
                        { $set: { pushedToRedis: true } }
                    );
                    console.log(`🚀 [GPTERS Newsletter List] Queued: [ID: ${id}] ${title} -> ${detailUrl}`);
                    queuedCount++;
                }
            }

            after = pageInfo.endCursor || null;
            if (queuedCount > 0) {
                console.log(`⏳ [GPTERS Newsletter List] ${queuedCount} queued so far (page ${page})`);
            }

            if (hasNextPage && (maxPages === 0 || page < maxPages) && slackSec > 0) {
                console.log(`💤 [GPTERS Newsletter List] ${slackSec}초 대기 후 다음 페이지 요청...`);
                await new Promise(resolve => setTimeout(resolve, slackSec * 1000));
            }
        } while (hasNextPage && (maxPages === 0 || page < maxPages));

        console.log(`🎉 [GPTERS Newsletter List] Done. Queried ${page} page(s), queued ${queuedCount} items.`);
        return queuedCount;
    }
}

if (require.main === module) {
    (async () => {
        const list = new GptersNewsletterList();
        try {
            await list.init();
            const limit = process.argv[2] ? parseInt(process.argv[2]) : 20;
            await list.run(limit);
        } catch (e: any) {
            console.error(`❌ Newsletter list failed: ${e.message}`);
        } finally {
            await list.close();
        }
    })();
}
