/**
 * @module QueueStatusChecker
 * @description Prints the sizes of all active Redis scrape queues and caches.
 * @constraints
 *   - Use centralized QueueStatusConfig injection for Redis connections.
 *   - Follow robust error handling and close connections in finally block.
 *   - Follow Strict OOP principles.
 * @dependencies Redis (ioredis)
 * @lastUpdated 2026-06-11
 */

import Redis from 'ioredis';

/**
 * Manages configuration and environment variables for the status check script.
 */
export class QueueStatusConfig {
    public readonly redisUrl: string;

    constructor() {
        this.redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    }
}

/**
 * Interface defining Queue status contract.
 */
export interface IQueueStatusChecker {
    check(): Promise<void>;
}

/**
 * Connects to Redis, scans for scrape_queue* keys, and prints their current length/size.
 */
export class QueueStatusChecker implements IQueueStatusChecker {
    private readonly config: QueueStatusConfig;

    constructor(config: QueueStatusConfig) {
        this.config = config;
    }

    public async check(): Promise<void> {
        console.log(`🔌 [QueueStatus] Connecting to Redis at ${this.config.redisUrl}...`);
        const redis = new Redis(this.config.redisUrl);

        try {
            const keys = await redis.keys('scrape_queue*');
            if (keys.length === 0) {
                console.log('ℹ️ [QueueStatus] No active scrape queues found in Redis.');
                return;
            }

            console.log(`\n📊 [QueueStatus] Found ${keys.length} active queue key(s):`);
            console.log('==================================================');
            for (const key of keys.sort()) {
                const type = await redis.type(key);
                if (type === 'list') {
                    const len = await redis.llen(key);
                    console.log(` 📝 Queue: [${key}] ➡️ Length: ${len} items`);
                } else if (type === 'set') {
                    const size = await redis.scard(key);
                    console.log(` 📁 Set: [${key}] ➡️ Size: ${size} items`);
                } else {
                    console.log(` ❓ Key: [${key}] ➡️ Type: ${type}`);
                }
            }
            console.log('==================================================\n');
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error(`❌ [QueueStatus] Error checking queue status: ${error.message}`);
        } finally {
            await redis.quit();
            console.log('🔌 [QueueStatus] Connection closed.');
        }
    }
}

// Execution Entry Point
const config = new QueueStatusConfig();
const checker = new QueueStatusChecker(config);
checker.check().catch((err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`❌ [QueueStatus] Fatal Error: ${error.message}`);
    process.exit(1);
});
