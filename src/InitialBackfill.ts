import { MongoDatabase } from './database/mongo';
import { Logger } from './utils';

// Converters
import { LinkedInMarkdownConverter } from './sites/linkedin/jobs/Converter';
import { CompanyMarkdownConverter } from './sites/linkedin/company/Converter';
import { GeekNewsConverter } from './sites/geeknews/Converter';
import { GptersConverter } from './sites/gpters/Converter';
import { PyTorchKRConverter } from './sites/pytorch_kr/Converter';

import { TargetLoader } from './TargetLoader';
import { PostgresDatabase } from './database/postgres';

async function runMigration() {
  Logger.info('🚀 Starting Initial Backfill Migration...');
  const mongo = MongoDatabase.getInstance();
  await mongo.connect();

  const migrations = [
    { site: 'linkedin', coll: 'linkedin.jobs', filterKey: 'jobId', converter: new LinkedInMarkdownConverter() },
    { site: 'linkedin_company', coll: 'linkedin.companies', filterKey: 'companyId', converter: new CompanyMarkdownConverter() }
  ];

  for (const m of migrations) {
    Logger.info(`📦 Migrating collection [${m.coll}]...`);
    const collection = await mongo.getCollection(m.coll);
    const cursor = collection.find({});
    
    let successCount = 0;
    let failCount = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc || !doc.rawHtml) continue;

      const id = doc[m.filterKey];
      try {
        const meta = m.converter.convertHtmlToMarkdown(doc.rawHtml, id, doc.url || '');
        await TargetLoader.load(m.site, id, meta);
        successCount++;
      } catch (err) {
        failCount++;
        Logger.error(`❌ Migration failed for [${m.site}] ID: ${id}`, err);
      }
    }
    Logger.info(`✅ Migration summary for [${m.coll}]: Success: ${successCount}, Fail: ${failCount}`);
  }

  // Close database connections
  await mongo.close();
  await PostgresDatabase.getInstance().close();
  Logger.info('🎉 Initial Backfill Migration completed successfully!');
}

runMigration().catch(async (err) => {
  Logger.error('💥 Fatal error during migration execution', err);
  try {
    await MongoDatabase.getInstance().close();
    await PostgresDatabase.getInstance().close();
  } catch {}
  process.exit(1);
});
