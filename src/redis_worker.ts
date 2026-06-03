import Redis from 'ioredis';
import { JobsScrapingPipeline } from './jobs/jobs_pipeline';
import { UrlUtils } from './utils';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const QUEUE_KEY = 'jobs_queue';
const CACHE_SET_KEY = 'completed_jobs';

async function main() {
  console.log(`📡 [Redis Worker] Connecting to Redis at ${REDIS_URL}...`);
  const redis = new Redis(REDIS_URL);
  
  redis.on('connect', () => console.log('✅ [Redis Worker] Connected to Redis.'));
  redis.on('error', (err) => console.error('❌ [Redis Worker] Redis error:', err));

  // Initialize pipeline
  const pipeline = new JobsScrapingPipeline();

  console.log('🚀 [Redis Worker] Worker started, listening to queue:', QUEUE_KEY);

  while (true) {
    try {
      // 1. Fetch task from queue with a blocking POP (wait up to 5 seconds)
      const res = await redis.blpop(QUEUE_KEY, 5);
      if (!res) {
        continue;
      }

      const url = res[1].trim();
      if (!url) continue;

      const jobId = UrlUtils.extractJobId(url);
      if (!jobId) {
        console.error(`⚠️ [Redis Worker] Failed to parse jobId from URL: ${url}`);
        continue;
      }

      // 2. Check if already completed
      const isCompleted = await redis.sismember(CACHE_SET_KEY, jobId);
      if (isCompleted) {
        console.log(`ℹ️ [Redis Worker] Job ${jobId} already exists in completed list. Skipping.`);
        continue;
      }

      console.log(`🏃 [Redis Worker] Processing Job ID: ${jobId}`);

      // 3. Process task
      const resultId = await pipeline.processSingleUrl(url);

      if (resultId) {
        // 4. Mark as completed in Redis cache
        await redis.sadd(CACHE_SET_KEY, resultId);
        console.log(`✅ [Redis Worker] Completed Job ID: ${jobId}`);
      }
    } catch (err: any) {
      console.error(`💥 [Redis Worker] Error processing task:`, err.message);

      // Handle critical auth wall / login session expired errors (shutdown so we don't spam rate limits)
      if (err.message && (err.message.includes('세션 만료') || err.message.includes('Auth Wall') || err.message.includes('로그인 요청'))) {
        console.error(`🛑 [Redis Worker] Critical login failure. Shutting down worker.`);
        await redis.quit();
        process.exit(1);
      }
    }
  }
}

main().catch((err) => {
  console.error('💥 [Redis Worker] Fatal crash:', err);
  process.exit(1);
});
