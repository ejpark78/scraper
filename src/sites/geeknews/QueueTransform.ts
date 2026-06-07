import { MongoDatabase } from '../../database/mongo';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const TRANSFORM_QUEUE = 'transform_queue';

async function main() {
    console.log('🔄 [Queue Transform] Fetching GeekNews items from bronze and pushing to transform_queue...');
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    const redis = new Redis(REDIS_URL);

    try {
        const bronzeGeeknews = await mongo.getCollection('bronze/geeknews.html');
        const docs = await bronzeGeeknews.find({}).toArray();

        console.log(`📥 Found ${docs.length} documents in bronze/geeknews.html.`);

        let count = 0;
        const payloads: string[] = [];

        for (const doc of docs) {
            const topicId = doc.topicId || doc.id;
            if (!topicId) continue;

            const payload = JSON.stringify({
                site: 'geeknews',
                id: topicId,
                bronze_db: 'bronze',
                bronze_collection: 'geeknews.html',
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
            console.log(`🚀 Successfully queued ${payloads.length} GeekNews transform tasks in Redis transform_queue.`);
        } else {
            console.log('💡 No GeekNews documents found to queue.');
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
