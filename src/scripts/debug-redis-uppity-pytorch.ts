import Redis from 'ioredis';
import { AppConfig } from '../config/AppConfig';

async function test() {
    const redis = new Redis(AppConfig.REDIS_URL);
    try {
        console.log('🔍 Scanning Redis queues for any task site/url mismatches...');
        const keys = await redis.keys('*queue*');
        console.log(`Found queue keys: ${keys.join(', ')}`);
        
        for (const key of keys) {
            const type = await redis.type(key);
            if (type === 'list') {
                const len = await redis.llen(key);
                const items = await redis.lrange(key, 0, -1);
                console.log(`\n📋 Checking list queue [${key}] (${len} items):`);
                let mismatchCount = 0;
                for (const item of items) {
                    try {
                        const parsed = JSON.parse(item);
                        // Case 1: site is pytorch_kr but url contains uppity
                        const url = parsed.url || parsed.id || '';
                        if (parsed.site === 'pytorch_kr' && (url.includes('uppity.co.kr') || parsed.bronze_collection?.includes('uppity'))) {
                            console.log(`  ⚠️ MISMATCH in [${key}]:`, parsed);
                            mismatchCount++;
                        }
                    } catch {}
                }
                if (mismatchCount === 0) {
                    console.log(`  ✅ [${key}] is clean.`);
                }
            }
        }
    } finally {
        await redis.quit();
    }
}

test();
