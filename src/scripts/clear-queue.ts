/**
 * @module QueueClearer
 * @description Clears all active Redis download/scrape queues, active processing sets, and dead letter queues.
 * @constraints
 *   - Use centralized QueueClearerConfig injection for Redis connection URL.
 *   - Follow robust error handling and ensure Redis connections are closed in finally block.
 *   - Follow Strict OOP principles.
 * @dependencies Redis (ioredis)
 * @lastUpdated 2026-06-11
 */

import Redis from 'ioredis';

/**
 * Manages configuration and environment variables for the queue clearing script.
 */
export class QueueClearerConfig {
    public readonly redisUrl: string;

    constructor() {
        this.redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    }
}

/**
 * Interface defining the Queue Clearer contract.
 */
export interface IQueueClearer {
    clear(): Promise<void>;
}

/**
 * Scans Redis for all scrape_queue* keys, active processing sets, and dead letter queues, and deletes them.
 */
export class QueueClearer implements IQueueClearer {
    private readonly config: QueueClearerConfig;

    constructor(config: QueueClearerConfig) {
        this.config = config;
    }

    public async clear(): Promise<void> {
        console.log(`🔌 [QueueClearer] Connecting to Redis at ${this.config.redisUrl}...`);
        const redis = new Redis(this.config.redisUrl);

        try {
            // Find all scrape queue keys (including site-specific and legacy)
            const keys = await redis.keys('scrape_queue*');
            
            // Add standard/dead letter/active processing keys
            const keysToClear = [...keys];
            
            const activeProcessingExists = await redis.exists('active_processing');
            if (activeProcessingExists) {
                keysToClear.push('active_processing');
            }
            
            const deadLetterExists = await redis.exists('dead_letter_queue');
            if (deadLetterExists) {
                keysToClear.push('dead_letter_queue');
            }

            if (keysToClear.length === 0) {
                console.log('ℹ️ [QueueClearer] No download queues or active sets found in Redis to clear.');
                return;
            }

            console.log(`🧹 [QueueClearer] Found ${keysToClear.length} key(s) to clear:`);
            for (const key of keysToClear) {
                console.log(`  - ${key}`);
            }

            // Delete the keys
            const deletedCount = await redis.del(...keysToClear);
            console.log(`✅ [QueueClearer] Successfully cleared download queues. Deleted ${deletedCount} Redis keys.`);

        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error(`❌ [QueueClearer] Failed to clear queues: ${error.message}`);
        } finally {
            await redis.quit();
            console.log('🔌 [QueueClearer] Connection closed.');
        }
    }
}

// Execution Entry Point
if (require.main === module) {
    const config = new QueueClearerConfig();
    const clearer = new QueueClearer(config);
    clearer.clear().catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(`❌ [QueueClearer] Fatal Error: ${error.message}`);
        process.exit(1);
    });
}
