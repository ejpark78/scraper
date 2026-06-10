import { MongoDatabase } from '../../../../database/mongo';
import Redis from 'ioredis';

export class JobsRefreshTransform {
  public async run(): Promise<void> {
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const redis = new Redis(redisUrl);

    const overwrite = process.env.OVERWRITE === 'true';

    console.log(`🚀 [Backfill] Starting Backfill Event Publisher (OVERWRITE: ${overwrite})`);

    // 1. Silver Layer에 이미 적재된 ID 조회
    const silverJobIds = new Set<string>();
    const silverCompanyIds = new Set<string>();

    if (!overwrite) {
      console.log('🔍 Fetching existing completed IDs from Silver Layer to prevent duplicates...');
      const completedJobs = await (await mongo.getCollection('silver/linkedin.jobs')).distinct('jobId');
      completedJobs.forEach(id => silverJobIds.add(String(id)));

      const completedCompanies = await (await mongo.getCollection('silver/linkedin.companies')).distinct('companyId');
      completedCompanies.forEach(id => silverCompanyIds.add(String(id)));

      console.log(`✅ Loaded ${silverJobIds.size} completed jobs and ${silverCompanyIds.size} completed companies.`);
    } else {
      console.log('⚠️ OVERWRITE=true is set. Skipping Silver Layer check. All records will be queued.');
    }

    const pushBuffer: string[] = [];
    const TRANSFORM_QUEUE = 'transform_queue';

    // 2. Job 백필 큐 구성
    console.log('📦 Scanning bronze/linkedin.jobs for missing items...');
    const bronzeJobsColl = await mongo.getCollection('bronze/linkedin.jobs');
    const jobCursor = bronzeJobsColl.find({}, { projection: { jobId: 1 } });
    
    while (await jobCursor.hasNext()) {
      const doc = await jobCursor.next();
      if (!doc || !doc.jobId) continue;
      const jobId = String(doc.jobId);

      if (!overwrite && silverJobIds.has(jobId)) continue;

      pushBuffer.push(JSON.stringify({
        site: 'linkedin',
        id: jobId,
        bronze_db: 'bronze',
        bronze_collection: 'linkedin.jobs',
        bronze_id: doc._id.toString(),
        attempt: 1
      }));
    }

    // 3. Company 백필 큐 구성
    console.log('📦 Scanning bronze/linkedin.companies for missing items...');
    const bronzeCompsColl = await mongo.getCollection('bronze/linkedin.companies');
    const compCursor = bronzeCompsColl.find({}, { projection: { companyId: 1 } });

    while (await compCursor.hasNext()) {
      const doc = await compCursor.next();
      if (!doc || !doc.companyId) continue;
      const companyId = String(doc.companyId);

      if (!overwrite && silverCompanyIds.has(companyId)) continue;

      pushBuffer.push(JSON.stringify({
        site: 'linkedin_company',
        id: companyId,
        bronze_db: 'bronze',
        bronze_collection: 'linkedin.companies',
        bronze_id: doc._id.toString(),
        attempt: 1
      }));
    }

    // 4. Redis에 벌크 푸시
    const totalTasks = pushBuffer.length;
    if (totalTasks > 0) {
      console.log(`📥 Pushing ${totalTasks} tasks to Redis ${TRANSFORM_QUEUE}...`);
      const chunkSize = 1000;
      for (let i = 0; i < totalTasks; i += chunkSize) {
        const chunk = pushBuffer.slice(i, i + chunkSize);
        await redis.rpush(TRANSFORM_QUEUE, ...chunk);
      }
      console.log(`✅ Successfully queued ${totalTasks} backfill tasks to Redis.`);
    } else {
      console.log('💡 All records are already processed and up to date. Nothing to backfill.');
    }

    await redis.quit();
    await mongo.close();
    console.log('🏁 [Backfill] Task generation completed!');
  }
}

if (require.main === module) {
  const backfiller = new JobsRefreshTransform();
  backfiller.run().catch(err => {
    console.error('💥 [Backfill] Fatal Error:', err);
    process.exit(1);
  });
}
