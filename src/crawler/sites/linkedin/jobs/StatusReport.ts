/**
 * @module StatusReport
 * @description Core functionality or script runner for StatusReport.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies mongo
 * @lastUpdated 2026-06-11
 */

import { MongoDatabase } from '../../../../database/mongo';

export class StatusReport {
  public async run(): Promise<void> {
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    console.log('\n📊 [LinkedIn Scraper System Status Report]');
    console.log('==================================================');

    // 1. 표 1: 레이어별 문서 비교 (Bronze vs Silver)
    const bronzeJobsCount = await (await mongo.getCollection('bronze/linkedin.jobs')).countDocuments();
    const silverJobsCount = await (await mongo.getCollection('silver/linkedin.jobs')).countDocuments();

    const bronzeCompsCount = await (await mongo.getCollection('bronze/linkedin.companies')).countDocuments();
    const silverCompsCount = await (await mongo.getCollection('silver/linkedin.companies')).countDocuments();

    // 천 단위 콤마 추가 및 정렬용 문자열 변환 함수 (기본적으로 10자리 우측 정렬 확보)
    const fmt = (num: number) => num.toLocaleString('ko-KR').padStart(12, ' ');

    console.log('\n📈 [Table 1] Layer Comparison (Bronze vs Silver)');
    console.table([
      {
        'Collection / Type': 'linkedin.jobs (채용공고)',
        'Bronze Layer (Raw)': fmt(bronzeJobsCount),
        'Silver Layer (Refined)': fmt(silverJobsCount),
        'Difference (Unprocessed)': fmt(bronzeJobsCount - silverJobsCount)
      },
      {
        'Collection / Type': 'linkedin.companies (회사정보)',
        'Bronze Layer (Raw)': fmt(bronzeCompsCount),
        'Silver Layer (Refined)': fmt(silverCompsCount),
        'Difference (Unprocessed)': fmt(bronzeCompsCount - silverCompsCount)
      }
    ]);

    // 2. 표 2: 수집 타겟 비교 (job_urls vs jobs)
    const totalJobUrls = await (await mongo.getCollection('bronze/linkedin.job_urls')).countDocuments();
    console.log('\n📋 [Table 2] Scraped vs Discovered (Target Comparison)');
    console.table([
      {
        'Metric Type': 'Discovered Targets (job_urls)',
        'Document Count': fmt(totalJobUrls)
      },
      {
        'Metric Type': 'Actual Scraped HTMLs (jobs)',
        'Document Count': fmt(bronzeJobsCount)
      },
      {
        'Metric Type': 'Difference (Not Yet Scraped)',
        'Document Count': fmt(totalJobUrls - bronzeJobsCount)
      }
    ]);

    // 3. 표 3: 국가별 적재 분포 (Geo Stats)
    console.log('\n🌍 [Table 3] Geography Distribution (Top 10 Geo Stats in Silver Layer)');
    const jobsCollection = await mongo.getCollection('silver/linkedin.jobs');
    const geoStats = await jobsCollection.aggregate([
      { $group: { _id: '$geo', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    console.table(
      geoStats.map(stat => ({
        'Country (Geo)': stat._id || 'Unknown',
        'Refined Jobs Count': fmt(stat.count)
      }))
    );

    console.log('==================================================\n');
    await mongo.close();
  }
}

if (require.main === module) {
  const reporter = new StatusReport();
  reporter.run().catch(err => {
    console.error('💥 [StatusReport] Fatal Error:', err);
    process.exit(1);
  });
}
