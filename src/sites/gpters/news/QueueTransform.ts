import Redis from 'ioredis';
import { MongoDatabase } from '../../../database/mongo';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6377';
const BATCH_SIZE = 500;

async function main() {
  console.log('🏁 [GPTERS QueueTransform] Streaming all bronze docs to transform_queue...');
  const mongo = MongoDatabase.getInstance();
  await mongo.connect();
  const redis = new Redis(REDIS_URL);

  try {
    const bronzeGpters = await mongo.getCollection('bronze/gpters.html');
    const total = await bronzeGpters.countDocuments();
    console.log(`📥 ${total} documents in bronze/gpters.html.`);

    const cursor = bronzeGpters.find({}).batchSize(BATCH_SIZE).sort({ _id: 1 });
    let queued = 0;
    let batch: any[] = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) continue;
      const id = doc.id || doc.postId;
      if (!id) continue;
      batch.push({ id, url: doc.url });
      if (batch.length >= BATCH_SIZE) {
        const pipeline = redis.pipeline();
        for (const { id, url } of batch) {
          pipeline.rpush('transform_queue', JSON.stringify({
            site: 'gpters', id, url,
            bronze_db: 'bronze', bronze_collection: 'gpters.html', bronze_id: id,
            timestamp: new Date().toISOString()
          }));
        }
        await pipeline.exec();
        queued += batch.length;
        console.log(`📤 Queued ${queued}/${total}...`);
        batch = [];
      }
    }

    if (batch.length > 0) {
      const pipeline = redis.pipeline();
      for (const { id, url } of batch) {
        pipeline.rpush('transform_queue', JSON.stringify({
          site: 'gpters', id, url,
          bronze_db: 'bronze', bronze_collection: 'gpters.html', bronze_id: id,
          timestamp: new Date().toISOString()
        }));
      }
      await pipeline.exec();
      queued += batch.length;
    }

    console.log(`\n✅ Done. Queued ${queued} transform tasks for GPTERS.`);
  } catch (e: any) {
    console.error('❌ Fatal:', e);
  } finally {
    await mongo.close();
    redis.disconnect();
    process.exit(0);
  }
}

main();
