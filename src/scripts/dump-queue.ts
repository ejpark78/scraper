/**
 * @module QueueDumper
 * @description Dumps the contents of all active Redis scrape queues to a single integrated JSON file in the data/ directory.
 * @constraints
 *   - Use centralized QueueDumperConfig injection for Redis and file paths.
 *   - Follow robust error handling and ensure Redis connections are closed.
 *   - Follow Strict OOP principles.
 * @dependencies Redis (ioredis), fs, path
 * @lastUpdated 2026-06-11
 */

import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Manages configuration and environment variables for the dump script.
 */
export class QueueDumperConfig {
    public readonly redisUrl: string;
    public readonly dumpFilePath: string;

    constructor() {
        this.redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        // Saved locally in data/ folder mapped to host
        this.dumpFilePath = process.env.DUMP_FILE_PATH || '/app/data/queue_dump.json';
    }
}

/**
 * Interface defining the Queue Dumper contract.
 */
export interface IQueueDumper {
    dump(): Promise<void>;
}

/**
 * Scans Redis for all scrape_queue* keys, fetches all items, and saves them to a structured JSON file.
 */
export class QueueDumper implements IQueueDumper {
    private readonly config: QueueDumperConfig;

    constructor(config: QueueDumperConfig) {
        this.config = config;
    }

    public async dump(): Promise<void> {
        console.log(`🔌 [QueueDumper] Connecting to Redis at ${this.config.redisUrl}...`);
        const redis = new Redis(this.config.redisUrl);

        try {
            const keys = await redis.keys('scrape_queue*');
            if (keys.length === 0) {
                console.log('ℹ️ [QueueDumper] No active scrape queues found in Redis.');
                return;
            }

            console.log(`🔍 [QueueDumper] Found ${keys.length} active queue key(s). Starting extraction...`);
            
            const dumpData: Record<string, any[]> = {};
            let totalItems = 0;

            for (const key of keys.sort()) {
                const type = await redis.type(key);
                if (type !== 'list') {
                    console.log(`ℹ️ [QueueDumper] Skipping non-list key '${key}' (type: ${type}).`);
                    continue;
                }

                const len = await redis.llen(key);
                console.log(`📥 [QueueDumper] Queue [${key}] ➡️ Length: ${len} items. Fetching...`);
                
                const rawItems = await redis.lrange(key, 0, -1);
                const parsedItems: any[] = [];

                for (const item of rawItems) {
                    try {
                        parsedItems.push(JSON.parse(item));
                    } catch {
                        parsedItems.push({ raw: item });
                    }
                }

                dumpData[key] = parsedItems;
                totalItems += len;
            }

            // Ensure destination directory exists
            const destDir = path.dirname(this.config.dumpFilePath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            console.log(`💾 [QueueDumper] Saving aggregated dump of ${totalItems} items to ${this.config.dumpFilePath}...`);
            const payload = {
                dumpedAt: new Date().toISOString(),
                totalQueuesCount: Object.keys(dumpData).length,
                totalItemsCount: totalItems,
                queues: dumpData
            };
            
            fs.writeFileSync(this.config.dumpFilePath, JSON.stringify(payload, null, 2), 'utf-8');
            console.log(`✅ [QueueDumper] Dump completed successfully!`);
            
            console.log(`\n📋 [QueueDumper] Summary of dumped queues:`);
            console.log('==================================================');
            for (const [key, items] of Object.entries(dumpData)) {
                console.log(` 📝 Queue: [${key}] ➡️ Length: ${items.length} items`);
            }
            console.log('==================================================\n');


        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error(`❌ [QueueDumper] Dump failed: ${error.message}`);
        } finally {
            await redis.quit();
            console.log('🔌 [QueueDumper] Connection closed.');
        }
    }
}

// Execution Entry Point
const config = new QueueDumperConfig();
const dumper = new QueueDumper(config);
dumper.dump().catch((err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`❌ [QueueDumper] Fatal Error: ${error.message}`);
    process.exit(1);
});
