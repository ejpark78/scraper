import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const REDIS_QUEUE_KEY = 'jobs_queue';

async function main() {
  const filePathArg = process.argv[2] || 'data/jobs/lists/urls.txt';
  const resolvedPath = path.resolve(process.cwd(), filePathArg);

  console.log(`📡 [Push URLs] Connecting to Redis at ${REDIS_URL}...`);
  const redis = new Redis(REDIS_URL);

  redis.on('error', (err) => {
    console.error('❌ [Push URLs] Redis connection error:', err);
  });

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ [Push URLs] File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`📖 [Push URLs] Reading tasks from: ${resolvedPath}`);
  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const urls = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (urls.length === 0) {
    console.log(`ℹ️ [Push URLs] No URLs found in the file to push.`);
    await redis.quit();
    process.exit(0);
  }

  console.log(`📥 [Push URLs] Pushing ${urls.length} URLs to Redis queue '${REDIS_QUEUE_KEY}'...`);
  
  // Push all URLs into the Redis List queue via pipeline (RPUSH)
  const pipeline = redis.pipeline();
  pipeline.rpush(REDIS_QUEUE_KEY, ...urls);
  const results = await pipeline.exec();

  const err = results?.find(([error]) => error);
  if (err) {
    console.error('❌ [Push URLs] Failed to push some URLs to Redis:', err[0]);
    process.exit(1);
  }

  console.log(`✅ [Push URLs] Successfully pushed ${urls.length} URLs to Redis.`);
  
  await redis.quit();
}

main().catch((err) => {
  console.error('💥 [Push URLs] Fatal error:', err);
  process.exit(1);
});
