import { MongoDatabase } from '../../../database/mongo';
import Redis from 'ioredis';

export class TransformerRefresh {
    public async run(): Promise<void> {
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        const redis = new Redis(redisUrl);

        const overwrite = process.env.OVERWRITE === 'true';

        console.log(`🚀 [Backfill] Starting Backfill Event Publisher for Daily Dose DS (OVERWRITE: ${overwrite})`);

        const silverIds = new Set<string>();
        if (!overwrite) {
            console.log('🔍 Fetching existing completed IDs from Silver Layer to prevent duplicates...');
            const completed = await (await mongo.getCollection('silver/dailydose_ds.html')).distinct('id');
            completed.forEach(id => silverIds.add(String(id)));
            console.log(`✅ Loaded ${silverIds.size} completed items.`);
        } else {
            console.log('⚠️ OVERWRITE=true is set. Skipping Silver Layer check.');
        }

        const pushBuffer: string[] = [];
        const TRANSFORM_QUEUE = 'transform_queue';

        console.log('📦 Scanning bronze/dailydose_ds.html for missing items...');
        const bronzeColl = await mongo.getCollection('bronze/dailydose_ds.html');
        const cursor = bronzeColl.find({}, { projection: { id: 1 } });
        
        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            if (!doc || !doc.id) continue;
            const id = String(doc.id);

            if (!overwrite && silverIds.has(id)) continue;

            pushBuffer.push(JSON.stringify({
                site: 'dailydose_ds',
                id: id,
                bronze_db: 'bronze',
                bronze_collection: 'dailydose_ds.html',
                bronze_id: doc._id.toString(),
                attempt: 1
            }));
        }

        const totalTasks = pushBuffer.length;
        if (totalTasks > 0) {
            console.log(`📥 Pushing ${totalTasks} tasks to Redis ${TRANSFORM_QUEUE}...`);
            const chunkSize = 1000;
            for (let i = 0; i < totalTasks; i += chunkSize) {
                const chunk = pushBuffer.slice(i, i + chunkSize);
                await redis.rpush(TRANSFORM_QUEUE, ...chunk);
            }
            console.log(`✅ Successfully queued ${totalTasks} backfill tasks to Redis.`);
        } else {
            console.log('💡 All records are already processed. Nothing to backfill.');
        }

        await redis.quit();
        await mongo.close();
        console.log('🏁 [Backfill] Task generation completed!');
    }
}

if (require.main === module) {
    const backfiller = new TransformerRefresh();
    backfiller.run().catch(err => {
        console.error('💥 [Backfill] Fatal Error:', err);
        process.exit(1);
    });
}
