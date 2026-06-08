import { MongoDatabase } from '../../database/mongo';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const TRANSFORM_QUEUE = 'transform_queue';
const BATCH_SIZE = 500;

async function main() {
    console.log('🔄 [Queue Transform] Pushing PyTorch KR items from bronze to transform_queue...');
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    const redis = new Redis(REDIS_URL);

    try {
        const bronzePytorch = await mongo.getCollection('bronze/pytorch_kr.html');
        const cursor = bronzePytorch.find({});
        const total = await bronzePytorch.countDocuments();
        console.log(`📥 Found ${total} documents in bronze/pytorch_kr.html.`);

        let count = 0;

        while (await cursor.hasNext()) {
            const batch: string[] = [];
            while (await cursor.hasNext() && batch.length < BATCH_SIZE) {
                const doc = await cursor.next();
                if (!doc) continue;
                const id = doc.topicId || doc.id || doc._id?.toString();
                if (!id) continue;

                const payload = JSON.stringify({
                    site: 'pytorch_kr',
                    id: id,
                    bronze_db: 'bronze',
                    bronze_collection: 'pytorch_kr.html',
                    bronze_id: doc._id.toString(),
                    timestamp: new Date().toISOString()
                });
                batch.push(payload);
            }

            if (batch.length > 0) {
                await redis.rpush(TRANSFORM_QUEUE, ...batch);
                count += batch.length;
                console.log(`🚀 Queued ${count}/${total} PyTorch KR transform tasks.`);
            }
        }

        console.log(`✅ Done. Total ${count} PyTorch KR transform tasks queued.`);

    } catch (e: any) {
        console.error('❌ Failed to queue transform tasks:', e);
    } finally {
        await redis.quit();
        await mongo.close();
        process.exit(0);
    }
}

main();
