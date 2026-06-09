import { MongoDatabase } from '../../database/mongo';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const TRANSFORM_QUEUE = 'transform_queue';
const BATCH_SIZE = 500;

async function main() {
  console.log('🔄 [Queue Transform] Pushing AiCasebook items from bronze to transform_queue...');
  const mongo = MongoDatabase.getInstance();
  await mongo.connect();

  const redis = new Redis(REDIS_URL);

  try {
    const bronzeColl = await mongo.getCollection('bronze/aicasebook.html');
    const cursor = bronzeColl.find({});
    const total = await bronzeColl.countDocuments();
    console.log(`📥 Found ${total} documents in bronze/aicasebook.html.`);

    let count = 0;

    while (await cursor.hasNext()) {
      const batch: string[] = [];
      while (await cursor.hasNext() && batch.length < BATCH_SIZE) {
        const doc = await cursor.next();
        if (!doc) continue;
        const docId = doc.id;
        if (!docId) continue;

        const payload = JSON.stringify({
          site: 'aicasebook',
          id: docId,
          bronze_db: 'bronze',
          bronze_collection: 'aicasebook.html',
          bronze_id: doc._id.toString(),
          timestamp: new Date().toISOString(),
        });
        batch.push(payload);
      }

      if (batch.length > 0) {
        await redis.rpush(TRANSFORM_QUEUE, ...batch);
        count += batch.length;
        console.log(`🚀 Queued ${count}/${total} AiCasebook transform tasks.`);
      }
    }

    console.log(`✅ Done. Total ${count} AiCasebook transform tasks queued.`);
  } catch (e: any) {
    console.error('❌ Failed to queue transform tasks:', e);
  } finally {
    await redis.quit();
    await mongo.close();
    process.exit(0);
  }
}

main();
