import { MongoDatabase } from '../database/mongo';
import * as cheerio from 'cheerio';

async function main() {
  const mongo = MongoDatabase.getInstance();
  await mongo.connect();

  const htmlColl = await mongo.getCollection('bronze/dailydose_ds.html');
  const urlsColl = await mongo.getCollection('bronze/dailydose_ds.urls');

  const htmlCount = await htmlColl.countDocuments();
  const urlsCount = await urlsColl.countDocuments();
  console.log(`bronze/dailydose_ds.html total docs: ${htmlCount}`);
  console.log(`bronze/dailydose_ds.urls total docs: ${urlsCount}`);

  const statuses = await urlsColl.distinct('status');
  console.log(`urls statuses:`, statuses);
  for (const st of statuses) {
    const c = await urlsColl.countDocuments({ status: st });
    console.log(`  status=${st}: ${c}`);
  }

  // Scan html docs for links containing dailydoseofds.com
  const cursor = htmlColl.find({}).project({ rawHtml: 1, url: 1 }).batchSize(50);
  let totalLinks = 0;
  let docsWithLinks = 0;
  const allFoundLinks = new Set<string>();

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc || !doc.rawHtml) continue;
    const $ = cheerio.load(doc.rawHtml);
    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      if (href.includes('dailydoseofds.com')) {
        links.push(href);
      }
    });
    if (links.length > 0) {
      docsWithLinks++;
      totalLinks += links.length;
      links.forEach(l => allFoundLinks.add(l));
    }
  }

  console.log(`\nHTML docs containing dailydoseofds.com links: ${docsWithLinks} / ${htmlCount}`);
  console.log(`Total <a href> containing dailydoseofds.com: ${totalLinks}`);
  console.log(`Unique href values: ${allFoundLinks.size}`);
  console.log(`\nAll unique links found:`);
  for (const l of [...allFoundLinks].sort()) {
    console.log(`  ${l}`);
  }

  // Count urls by status
  const completed = await urlsColl.countDocuments({ status: 'completed' });
  const failed = await urlsColl.countDocuments({ status: 'failed' });
  const newStatus = await urlsColl.countDocuments({ status: 'new' });
  const noStatus = await urlsColl.countDocuments({ status: { $exists: false } });
  console.log(`\nurls detail:`);
  console.log(`  completed: ${completed}`);
  console.log(`  failed: ${failed}`);
  console.log(`  new: ${newStatus}`);
  console.log(`  no status: ${noStatus}`);

  await mongo.close();
}

main().catch(console.error);
