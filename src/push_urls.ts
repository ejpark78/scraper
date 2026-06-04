import Redis from 'ioredis';
import { MongoDatabase } from './database/mongo';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const JOBS_QUEUE_KEY = 'jobs_queue';
const COMPANY_QUEUE_KEY = 'company_queue';

async function main() {
  console.log(`📡 [Push URLs] Connecting to Redis at ${REDIS_URL}...`);
  const redis = new Redis(REDIS_URL);

  redis.on('error', (err) => {
    console.error('❌ [Push URLs] Redis connection error:', err);
  });

  // Connect to MongoDB
  console.log(`🔌 [Push URLs] Connecting to MongoDB...`);
  const mongo = MongoDatabase.getInstance();

  try {
    // 1. Fetch pending Job URLs from MongoDB
    const jobUrlsColl = await mongo.getCollection('bronze.job_urls');
    const pendingJobs = await jobUrlsColl
      .find({ status: 'new', pushedToRedis: { $ne: true } })
      .project({ url: 1, jobId: 1 })
      .toArray();

    console.log(`🔍 [Push URLs] Found ${pendingJobs.length} new job URLs in MongoDB.`);

    // 2. Fetch pending Company URLs from MongoDB
    const companyUrlsColl = await mongo.getCollection('bronze.company_urls');
    const pendingCompanies = await companyUrlsColl
      .find({ status: 'new', pushedToRedis: { $ne: true } })
      .project({ url: 1, companyId: 1 })
      .toArray();

    console.log(`🔍 [Push URLs] Found ${pendingCompanies.length} new company URLs in MongoDB.`);

    if (pendingJobs.length === 0 && pendingCompanies.length === 0) {
      console.log(`ℹ️ [Push URLs] No new URLs found to push.`);
      await redis.quit();
      await mongo.close();
      process.exit(0);
    }

    // 3. Push Job URLs to Redis
    if (pendingJobs.length > 0) {
      const jobUrls = pendingJobs.map(doc => doc.url);
      console.log(`📥 [Push URLs] Pushing ${jobUrls.length} jobs to Redis list '${JOBS_QUEUE_KEY}'...`);
      
      const chunkSize = 1000;
      for (let i = 0; i < jobUrls.length; i += chunkSize) {
        const chunk = jobUrls.slice(i, i + chunkSize);
        await redis.rpush(JOBS_QUEUE_KEY, ...chunk);
      }

      // Mark as pushed in MongoDB
      const jobIds = pendingJobs.map(doc => doc.jobId);
      await jobUrlsColl.updateMany(
        { jobId: { $in: jobIds } },
        { $set: { pushedToRedis: true, updatedAt: new Date() } }
      );
      console.log(`✅ [Push URLs] Successfully marked ${jobIds.length} jobs as pushed in MongoDB.`);
    }

    // 4. Push Company URLs to Redis
    if (pendingCompanies.length > 0) {
      const companyUrls = pendingCompanies.map(doc => doc.url);
      console.log(`📥 [Push URLs] Pushing ${companyUrls.length} companies to Redis list '${COMPANY_QUEUE_KEY}'...`);

      const chunkSize = 1000;
      for (let i = 0; i < companyUrls.length; i += chunkSize) {
        const chunk = companyUrls.slice(i, i + chunkSize);
        await redis.rpush(COMPANY_QUEUE_KEY, ...chunk);
      }

      // Mark as pushed in MongoDB
      const companyIds = pendingCompanies.map(doc => doc.companyId);
      await companyUrlsColl.updateMany(
        { companyId: { $in: companyIds } },
        { $set: { pushedToRedis: true, updatedAt: new Date() } }
      );
      console.log(`✅ [Push URLs] Successfully marked ${companyIds.length} companies as pushed in MongoDB.`);
    }

  } catch (error) {
    console.error('❌ [Push URLs] Error during queue pushing:', error);
    process.exit(1);
  } finally {
    await redis.quit();
    await mongo.close();
    console.log(`🔌 [Push URLs] Connections closed.`);
  }
}

main().catch((err) => {
  console.error('💥 [Push URLs] Fatal error:', err);
  process.exit(1);
});
