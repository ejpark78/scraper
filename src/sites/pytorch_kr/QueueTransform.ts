import { MongoDatabase } from '../../database/mongo';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const TRANSFORM_QUEUE = 'transform_queue';

async function main() {
    console.log('🔄 [Queue Transform] Pushing PyTorch KR items from bronze to transform_queue...');
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    const redis = new Redis(REDIS_URL);

    try {
        const bronzePytorch = await mongo.getCollection('bronze/pytorch_kr.html');
        const docs = await bronzePytorch.find({}).toArray();

        console.log(`📥 Found ${docs.length} documents in bronze/pytorch_kr.html.`);

        let count = 0;
        const payloads: string[] = [];

        for (const doc of docs) {
            const id = doc.id || doc._id?.toString();
            if (!id) continue;

            const payload = JSON.stringify({
                site: 'pytorch_kr',
                id: id,
                bronze_db: 'bronze',
                bronze_collection: 'pytorch_kr.html',
                bronze_id: doc._id.toString(),
                timestamp: new Date().toISOString()
            });

            payloads.push(payload);
        }

        if (payloads.length > 0) {
            const chunkSize = 500;
            for (let i = 0; i < payloads.length; i += chunkSize) {
                const chunk = payloads.slice(i, i + chunkSize);
                await redis.rpush(TRANSFORM_QUEUE, ...chunk);
            }
            console.log(`🚀 Successfully queued ${payloads.length} PyTorch KR transform tasks in Redis transform_queue.`);
        } else {
            console.log('💡 No PyTorch KR documents found to queue.');
        }

    } catch (e: any) {
        console.error('❌ Failed to queue transform tasks:', e);
    } finally {
        await redis.quit();
        await mongo.close();
        process.exit(0);
    }
}

main();
