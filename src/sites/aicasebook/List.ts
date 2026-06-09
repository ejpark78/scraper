import { chromium } from 'playwright';
import Redis from 'ioredis';
import { MongoDatabase } from '../../database/mongo';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const CACHE_SET_KEY = 'completed_aicasebook';

export class AiCasebookList {
  private redis!: Redis;

  public async init(): Promise<void> {
    this.redis = new Redis(REDIS_URL);
    console.log(`📡 [AiCasebook List] Connected to Redis for queueing.`);
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

  public async run(): Promise<number> {
    const sleepSec = parseInt(process.env.SLACK_TIME || '3', 10);
    if (sleepSec > 0) {
      console.log(`💤 [AiCasebook List] 스크래핑 전 ${sleepSec}초 대기 중...`);
      await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
    }

    console.log(`🌐 [AiCasebook List] Launching browser for main page...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    try {
      await page.goto('https://aicasebook.dev/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('a[href^="/setup/"]', { timeout: 10000 });

      const items = await page.$$eval('a[href^="/setup/"]', (els) => {
        const seen = new Set<string>();
        return els
          .map((el) => {
            const anchor = el as HTMLAnchorElement;
            const href = anchor.href;
            const match = href.match(/\/setup\/(\d+)/);
            if (!match) return null;
            const id = match[1];
            if (seen.has(id)) return null;
            seen.add(id);
            return { id, url: href };
          })
          .filter(Boolean) as { id: string; url: string }[];
      });

      console.log(`🔍 [AiCasebook List] Found ${items.length} unique articles on main page.`);

      const dbInstance = MongoDatabase.getInstance();
      const urlsColl = await dbInstance.getCollection('bronze/aicasebook.urls');

      const completedCount = await this.redis.scard(CACHE_SET_KEY);
      if (completedCount === 0) {
        try {
          console.log(`🔍 [AiCasebook List] Redis cache is empty. Seeding from MongoDB bronze/aicasebook...`);
          const bronzeColl = await dbInstance.getCollection('bronze/aicasebook.html');
          const existing = await bronzeColl.find({}, { projection: { id: 1, _id: 0 } }).toArray();
          if (existing.length > 0) {
            const pipeline = this.redis.pipeline();
            existing.forEach((doc: any) => {
              if (doc.id) pipeline.sadd(CACHE_SET_KEY, String(doc.id));
            });
            await pipeline.exec();
            console.log(`📡 [AiCasebook List] Seeded ${existing.length} completed IDs into Redis cache.`);
          }
        } catch (err: any) {
          console.warn(`⚠️ MongoDB seed skipped or failed: ${err.message}`);
        }
      }

      let queuedCount = 0;
      const overwrite = process.env.OVERWRITE === 'true';
      const scraperSlackVal = process.env.SCRAPER_SLACK ? parseInt(process.env.SCRAPER_SLACK, 10) : 0;
      const priority = process.env.PRIORITY || 'medium';

      for (const item of items) {
        const { id, url } = item;

        if (overwrite) {
          await this.redis.srem(CACHE_SET_KEY, id);
        }
        const isCompleted = overwrite ? false : await this.redis.sismember(CACHE_SET_KEY, id);

        await urlsColl.updateOne(
          { id },
          {
            $set: {
              id,
              url,
              status: isCompleted ? 'completed' : 'new',
              updatedAt: new Date(),
            },
            $setOnInsert: {
              pushedToRedis: isCompleted,
            },
          },
          { upsert: true }
        );

        if (isCompleted) {
          console.log(`⏭️ [AiCasebook List] Skipping already completed: [ID: ${id}]`);
          continue;
        }

        const doc = await urlsColl.findOne({ id });
        const alreadyPushed = doc?.pushedToRedis || false;

        if (!alreadyPushed) {
          const payload = JSON.stringify({
            site: 'aicasebook',
            url,
            attempt: 1,
            priority,
            ...(scraperSlackVal > 0 ? { scraperSlack: scraperSlackVal } : {}),
          });
          await this.redis.rpush(`scrape_queue:aicasebook:${priority}`, payload);
          await urlsColl.updateOne({ id }, { $set: { pushedToRedis: true } });
          console.log(`🚀 [AiCasebook List] Queued: [ID: ${id}] -> ${url}`);
          queuedCount++;
        }
      }

      console.log(`🎉 [AiCasebook List] Successfully queued ${queuedCount} items.`);
      return queuedCount;
    } finally {
      await browser.close();
    }
  }
}

if (require.main === module) {
  (async () => {
    const list = new AiCasebookList();
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
