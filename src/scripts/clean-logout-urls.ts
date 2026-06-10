import { MongoDatabase } from '../database/mongo';
import Redis from 'ioredis';

async function main() {
    console.log('🧼 [Clean Script] Starting cleanup for logout URLs...');
    
    // 1. MongoDB Cleanup
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();
    
    try {
        const urlsColl = await mongo.getCollection('bronze/uppity.urls');
        const query = { url: { $regex: /logout/i } };
        const matchCount = await urlsColl.countDocuments(query);
        
        console.log(`🔍 [MongoDB] Found ${matchCount} matching documents with 'logout' in bronze/uppity.urls.`);
        if (matchCount > 0) {
            const deleteResult = await urlsColl.deleteMany(query);
            console.log(`✅ [MongoDB] Deleted ${deleteResult.deletedCount} documents from bronze/uppity.urls.`);
        } else {
            console.log(`ℹ️ [MongoDB] No documents to delete.`);
        }
    } catch (err: any) {
        console.error(`❌ [MongoDB] Error during cleanup: ${err.message}`);
    } finally {
        await mongo.close();
    }

    // 2. Redis Cleanup
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    console.log(`🔌 [Redis] Connecting to ${redisUrl}...`);
    const redis = new Redis(redisUrl);

    try {
        const queueKeys = [
            'scrape_queue:uppity:high',
            'scrape_queue:uppity:medium',
            'scrape_queue:uppity:low',
            'scrape_queue' // Legacy common queue
        ];

        for (const key of queueKeys) {
            const exists = await redis.exists(key);
            if (!exists) {
                console.log(`ℹ️ [Redis] Queue key '${key}' does not exist. Skipping.`);
                continue;
            }

            const type = await redis.type(key);
            if (type !== 'list') {
                console.log(`ℹ️ [Redis] Key '${key}' is not a list (type: ${type}). Skipping.`);
                continue;
            }

            const len = await redis.llen(key);
            if (len === 0) {
                console.log(`ℹ️ [Redis] Queue key '${key}' is empty.`);
                continue;
            }

            const items = await redis.lrange(key, 0, -1);
            const keepItems: string[] = [];
            let removedCount = 0;

            for (const item of items) {
                try {
                    const parsed = JSON.parse(item);
                    const isUppity = key.includes('uppity') || parsed.site === 'uppity';
                    const hasLogout = parsed.url && typeof parsed.url === 'string' && parsed.url.toLowerCase().includes('logout');

                    if (isUppity && hasLogout) {
                        removedCount++;
                    } else {
                        keepItems.push(item);
                    }
                } catch {
                    if (item.toLowerCase().includes('logout')) {
                        removedCount++;
                    } else {
                        keepItems.push(item);
                    }
                }
            }

            if (removedCount > 0) {
                console.log(`🗑️ [Redis] Found ${removedCount} items containing 'logout' in list '${key}'. Cleaning...`);
                await redis.del(key);
                if (keepItems.length > 0) {
                    await redis.rpush(key, ...keepItems);
                }
                console.log(`✅ [Redis] Cleaned list '${key}'. (Remaining items: ${keepItems.length})`);
            } else {
                console.log(`ℹ️ [Redis] No matching items to remove in list '${key}'.`);
            }
        }
    } catch (err: any) {
        console.error(`❌ [Redis] Error during cleanup: ${err.message}`);
    } finally {
        await redis.quit();
        console.log('🔌 [Redis] Connection closed.');
    }

    console.log('✨ [Clean Script] Finished cleanup.');
}

main().catch((err) => {
    console.error(`❌ Fatal Error: ${err.message}`);
    process.exit(1);
});
