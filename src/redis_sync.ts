import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_FILE_PATH = path.resolve(__dirname, '../data/jobs/lists/cache.list');
const REDIS_KEY = 'completed_jobs';

async function main() {
  console.log(`📡 [Redis Sync] Connecting to Redis at ${REDIS_URL}...`);
  const redis = new Redis(REDIS_URL);

  redis.on('connect', () => console.log('✅ [Redis Sync] Connected to Redis.'));
  redis.on('error', (err) => console.error('❌ [Redis Sync] Redis error:', err));

  // 1. Ensure directory and file exist
  const dir = path.dirname(CACHE_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(CACHE_FILE_PATH)) {
    fs.writeFileSync(CACHE_FILE_PATH, '');
  }

  // 2. Initial sync of existing cache.list
  console.log(`🔍 [Redis Sync] Initial synchronization from: ${CACHE_FILE_PATH}`);
  const initialContent = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
  const initialIds = initialContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (initialIds.length > 0) {
    console.log(`📥 [Redis Sync] Pushing ${initialIds.length} existing IDs to Redis...`);
    // Push in chunks to prevent large payload errors
    const chunkSize = 1000;
    for (let i = 0; i < initialIds.length; i += chunkSize) {
      const chunk = initialIds.slice(i, i + chunkSize);
      await redis.sadd(REDIS_KEY, ...chunk);
    }
    console.log(`✅ [Redis Sync] Pushed ${initialIds.length} existing IDs successfully.`);
  } else {
    console.log(`ℹ️ [Redis Sync] Cache file is empty. Starting fresh.`);
  }

  // 3. Real-time watch via fs.watchFile (polling-based for stability across Docker/VM bounds)
  let currentSize = fs.statSync(CACHE_FILE_PATH).size;
  console.log(`👀 [Redis Sync] Watching cache.list for updates (Current size: ${currentSize} bytes)...`);

  fs.watchFile(CACHE_FILE_PATH, { interval: 1000 }, async (curr, prev) => {
    if (curr.size > prev.size) {
      const stream = fs.createReadStream(CACHE_FILE_PATH, {
        start: prev.size,
        end: curr.size - 1,
        encoding: 'utf-8',
      });

      let chunk = '';
      stream.on('data', (data) => {
        chunk += data;
      });

      stream.on('end', async () => {
        const newIds = chunk
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (newIds.length > 0) {
          console.log(`📥 [Redis Sync] New completion detected! SADD ${newIds.join(', ')}`);
          await redis.sadd(REDIS_KEY, ...newIds);
        }
      });
    }
    currentSize = curr.size;
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 [Redis Sync] Shutting down, closing connections...');
    fs.unwatchFile(CACHE_FILE_PATH);
    await redis.quit();
    console.log('👋 [Redis Sync] Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('💥 [Redis Sync] Fatal error:', err);
  process.exit(1);
});
