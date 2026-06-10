/**
 * @module LogoutUrlCleaner
 * @description Cleans up URLs containing 'logout' from MongoDB (bronze/uppity.urls) and Redis queues.
 * @constraints
 *   - Must use centralized CleanupConfig injection instead of direct process.env access.
 *   - Close both MongoDB and Redis connections in finally blocks to prevent connection leaks.
 *   - Follow Strict OOP: run operations using the IUrlCleaner interface.
 * @dependencies MongoDB (bronze/uppity.urls), Redis (scrape_queue*)
 * @lastUpdated 2026-06-11
 */

import { MongoDatabase } from '../database/mongo';
import Redis from 'ioredis';


/**
 * Rule 4: Centralized Config
 * Manages configuration and environment variables for the cleanup scripts.
 */
export class CleanupConfig {
    public readonly mongoUrl: string;
    public readonly redisUrl: string;

    constructor() {
        this.mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
        this.redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    }
}

/**
 * Rule 1: Strict OOP Patterns
 * Interface defining URL cleaning contracts.
 */
export interface IUrlCleaner {
    clean(): Promise<void>;
}

/**
 * Rule 1 & 2: Strict OOP implementation with strong typing.
 * Cleans both MongoDB and Redis queues of matching logout URLs.
 */
export class LogoutUrlCleaner implements IUrlCleaner {
    private readonly config: CleanupConfig;
    private readonly targetPattern: RegExp = /logout/i;
    private readonly queueKeys: string[] = [
        'scrape_queue:uppity:high',
        'scrape_queue:uppity:medium',
        'scrape_queue:uppity:low',
        'scrape_queue' // Legacy common queue
    ];

    constructor(config: CleanupConfig) {
        this.config = config;
    }

    public async clean(): Promise<void> {
        console.log('🧼 [LogoutUrlCleaner] Starting cleanup operations...');
        await this.cleanMongo();
        await this.cleanRedis();
        console.log('✨ [LogoutUrlCleaner] Cleanup operations complete.');
    }

    /**
     * Rule 3: Robust Error Handling & Finally cleanups
     */
    private async cleanMongo(): Promise<void> {
        const mongo = MongoDatabase.getInstance();
        try {
            await mongo.connect();
            const urlsColl = await mongo.getCollection('bronze/uppity.urls');
            const query = { url: { $regex: this.targetPattern } };
            const matchCount = await urlsColl.countDocuments(query);
            
            console.log(`🔍 [MongoDB] Found ${matchCount} matching documents in bronze/uppity.urls.`);
            if (matchCount > 0) {
                const deleteResult = await urlsColl.deleteMany(query);
                console.log(`✅ [MongoDB] Successfully deleted ${deleteResult.deletedCount} documents.`);
            } else {
                console.log('ℹ️ [MongoDB] No documents match the criteria.');
            }
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error(`❌ [MongoDB] Error during cleanup: ${error.message}`, error);
        } finally {
            await mongo.close();
        }
    }

    /**
     * Rule 3: Robust Error Handling & Finally cleanups
     */
    private async cleanRedis(): Promise<void> {
        console.log(`🔌 [Redis] Connecting to ${this.config.redisUrl}...`);
        const redis = new Redis(this.config.redisUrl);

        try {
            for (const key of this.queueKeys) {
                const exists = await redis.exists(key);
                if (!exists) {
                    console.log(`ℹ️ [Redis] Queue '${key}' does not exist.`);
                    continue;
                }

                const type = await redis.type(key);
                if (type !== 'list') {
                    console.log(`ℹ️ [Redis] Key '${key}' is not a list (type: ${type}).`);
                    continue;
                }

                const len = await redis.llen(key);
                if (len === 0) {
                    console.log(`ℹ️ [Redis] Queue '${key}' is empty.`);
                    continue;
                }

                const items = await redis.lrange(key, 0, -1);
                const keepItems: string[] = [];
                let removedCount = 0;

                for (const item of items) {
                    try {
                        const parsed: Record<string, unknown> = JSON.parse(item);
                        const isUppity = key.includes('uppity') || parsed.site === 'uppity';
                        const hasLogout = typeof parsed.url === 'string' && 
                                          parsed.url.toLowerCase().includes('logout');

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
                    console.log(`🗑️ [Redis] Found ${removedCount} logout items in '${key}'. Cleaning...`);
                    await redis.del(key);
                    if (keepItems.length > 0) {
                        await redis.rpush(key, ...keepItems);
                    }
                    console.log(`✅ [Redis] Cleaned queue '${key}' (Remaining: ${keepItems.length}).`);
                } else {
                    console.log(`ℹ️ [Redis] No matching items in queue '${key}'.`);
                }
            }
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error(`❌ [Redis] Error during queue cleanup: ${error.message}`, error);
        } finally {
            await redis.quit();
            console.log('🔌 [Redis] Connection closed.');
        }
    }
}

// Execution Entry Point
const config = new CleanupConfig();
const cleaner = new LogoutUrlCleaner(config);
cleaner.clean().catch((err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`❌ Fatal Error during execution: ${error.message}`, error);
    process.exit(1);
});
