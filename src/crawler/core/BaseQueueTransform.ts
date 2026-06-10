import { MongoDatabase } from '../../database/mongo';
import Redis from 'ioredis';

export interface QueueTransformConfig {
    site: string;
    bronzeCollection: `bronze/${string}`;
    silverCollection?: `silver/${string}`;
    idExtract?: (doc: any) => string | null;
    includeUrlInPayload?: boolean;
}

export class BaseQueueTransform {
    constructor(protected config: QueueTransformConfig) {}

    public async run(): Promise<void> {
        const { site, bronzeCollection, includeUrlInPayload } = this.config;
        const silverCollection = this.config.silverCollection ?? `silver/${site}.contents` as `silver/${string}`;
        const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
        const TRANSFORM_QUEUE = 'transform_queue';
        const BATCH_SIZE = 500;

        console.log(`🔄 [Queue Transform] Pushing ${site} items from bronze to transform_queue...`);
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        const redis = new Redis(REDIS_URL);

        try {
            const overwrite = process.env.OVERWRITE === 'true';
            const completedIds = new Set<string>();
            if (!overwrite) {
                const silverColl = await mongo.getCollection(silverCollection);
                const completed = await silverColl.distinct('id');
                completed.forEach(id => completedIds.add(String(id)));
                console.log(`📥 Loaded ${completedIds.size} already completed ${site} IDs from Silver Layer.`);
            } else {
                console.log('⚠️ OVERWRITE=true — skipping Silver Layer check.');
            }

            const bronzeColl = await mongo.getCollection(bronzeCollection);
            const cursor = bronzeColl.find({});
            const total = await bronzeColl.countDocuments();
            console.log(`📥 Found ${total} documents in ${bronzeCollection}.`);

            let count = 0;

            while (await cursor.hasNext()) {
                const batch: string[] = [];
                while (await cursor.hasNext() && batch.length < BATCH_SIZE) {
                    const doc = await cursor.next();
                    if (!doc) continue;
                    const id = this.config.idExtract ? this.config.idExtract(doc) : (doc.id || null);
                    if (!id) continue;

                    if (!overwrite && completedIds.has(String(id))) continue;

                    const payload: Record<string, any> = {
                        site,
                        id,
                        bronze_db: 'bronze',
                        bronze_collection: bronzeCollection.replace('bronze/', ''),
                        bronze_id: doc._id.toString(),
                        timestamp: new Date().toISOString(),
                    };
                    if (includeUrlInPayload && doc.url) {
                        payload.url = doc.url;
                    }

                    batch.push(JSON.stringify(payload));
                }

                if (batch.length > 0) {
                    await redis.rpush(TRANSFORM_QUEUE, ...batch);
                    count += batch.length;
                    console.log(`🚀 Queued ${count}/${total} ${site} transform tasks.`);
                }
            }

            console.log(`✅ Done. Total ${count} ${site} transform tasks queued.`);
        } catch (e: any) {
            console.error('❌ Failed to queue transform tasks:', e);
        } finally {
            await redis.quit();
            await mongo.close();
            process.exit(0);
        }
    }
}
