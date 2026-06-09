import { MongoDatabase } from '../../../database/mongo';
import Redis from 'ioredis';

const CACHE_SET_KEY = 'completed_aicasebook';

export class AiCasebookRefreshUrls {
  public async run(): Promise<void> {
    console.log('🔄 [AiCasebook Refresh Urls] Starting recovery of uncollected targets...');
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const redis = new Redis(redisUrl);

    try {
      const bronzeColl = await mongo.getCollection('bronze/aicasebook.html');
      const urlsColl = await mongo.getCollection('bronze/aicasebook.urls');

      const completedIds = await bronzeColl.distinct('id');
      console.log(`📥 Loaded ${completedIds.length} already completed AiCasebook IDs.`);

      const queueLength = await redis.llen('scrape_queue');
      const existingQueuePayloads = queueLength > 0 ? await redis.lrange('scrape_queue', 0, -1) : [];
      const existingQueueUrls = new Set<string>();
      for (const payloadStr of existingQueuePayloads) {
        try {
          const payload = JSON.parse(payloadStr);
          if (payload.site === 'aicasebook' && payload.url) {
            existingQueueUrls.add(payload.url);
          }
        } catch (e) {
          // Ignore
        }
      }

      const overwrite = process.env.OVERWRITE === 'true';
      const query = overwrite ? {} : { id: { $nin: completedIds } };
      const targets = await urlsColl.find(query, {
        projection: { id: 1, url: 1 },
      }).toArray();

      const filteredJobs = targets.filter(j => j.url && (overwrite || !existingQueueUrls.has(j.url)));

      if (filteredJobs.length > 0) {
        if (overwrite) {
          for (const j of filteredJobs) {
            await redis.srem(CACHE_SET_KEY, j.id);
          }
        }

        const priority = process.env.PRIORITY || 'medium';
        const payloads = filteredJobs.map(j =>
          JSON.stringify({
            site: 'aicasebook',
            url: j.url,
            attempt: 1,
            priority,
          })
        );

        const chunkSize = 1000;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          await redis.rpush(`scrape_queue:aicasebook:${priority}`, ...chunk);
        }

        const idsToUpdate = filteredJobs.map(j => j.id);
        await urlsColl.updateMany(
          { id: { $in: idsToUpdate } },
          { $set: { pushedToRedis: true, status: 'new', updatedAt: new Date() } }
        );

        console.log(`✨ Recovery complete! Redis Queue Pushed: ${filteredJobs.length}`);
      } else {
        console.log('💡 No new target items to recover.');
      }
    } catch (err: any) {
      console.error('❌ Error during queue recovery:', err);
    } finally {
      await redis.quit();
      await mongo.close();
      process.exit(0);
    }
  }
}

if (require.main === module) {
  const refresh = new AiCasebookRefreshUrls();
  refresh.run().catch(console.error);
}
