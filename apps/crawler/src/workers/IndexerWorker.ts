/**
 * @module IndexerWorker
 * @description Listens to Redis queues, fetches processed documents from MongoDB Silver, and indexes them into Meilisearch.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies Redis, MongoDB, Meilisearch, SiteRegistry
 * @lastUpdated 2026-06-15
 */

import Redis from 'ioredis';
import { MongoDatabase } from '../../../../packages/database/mongo';
import { MeiliSearchDatabase } from '../../../../packages/database/meili';
import { Logger } from '../utils';
import { getSite, getIndexName } from '../core/SiteRegistry';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const INDEX_QUEUE = 'index_queue';
const DEAD_LETTER_QUEUE = 'dead_letter_queue';

interface IndexPayload {
  site: string;
  id: string;
  attempt?: number;
}

async function main() {
  Logger.info(`Connecting to Redis at ${REDIS_URL}...`);
  const redis = new Redis(REDIS_URL);
  const mongo = MongoDatabase.getInstance();
  const meili = MeiliSearchDatabase.getInstance();

  await mongo.connect();
  Logger.info(`Indexer Worker started, listening to: ${INDEX_QUEUE}`);

  while (true) {
    try {
      const res = await redis.blpop(INDEX_QUEUE, 5);
      if (!res) continue;

      const payloadRaw = res[1].trim();
      if (!payloadRaw) continue;

      const task: IndexPayload = JSON.parse(payloadRaw);
      const { site, id } = task;
      const attempt = task.attempt || 1;

      Logger.info(`[Indexer] POP task [${site}] ID: ${id}`);

      await Logger.contextStorage.run({ site, url: id }, async () => {
        try {
          const desc = getSite(site);
          if (!desc?.targetLoader) {
            throw new Error(`No target loader configuration for site: ${site}`);
          }

          const tl = desc.targetLoader;
          const collection = await mongo.getCollection(tl.collectionName);
          const doc = await collection.findOne({ [tl.filterField]: id });

          if (!doc) {
            throw new Error(`Document not found in Silver database (${tl.collectionName}) for ID: ${id}`);
          }

          // Parse publication/creation date
          let publishedAt = doc.publishedAt || doc.collectedAt || doc.createdAt || doc.scrapedAt || doc.updatedAt || null;
          if (!publishedAt) {
            if (site === 'linkedin' && doc.description) {
              const match = doc.description.match(/posted_date:\s*"([^"]+)"/) || doc.description.match(/\*\*포스팅 날짜 \(Posted Date\):\*\*\s*([^\n]+)/);
              if (match) {
                publishedAt = match[1].trim();
              }
            } else if (site === 'geeknews' && (doc.markdown || doc.content)) {
              const md = doc.markdown || doc.content || '';
              const match = md.match(/\*\*작성일:\*\*\s*([^\n]+)/);
              if (match && match[1].trim() !== '정보 없음') {
                publishedAt = match[1].trim();
              }
            }
          }

          if (!publishedAt) {
            publishedAt = new Date().toISOString();
          }

          const meiliDoc = {
            id: `${site}_${id}`, // Unique composite ID
            site: site,
            docId: id,
            title: doc.title || doc.jobTitle || 'Untitled',
            companyName: doc.companyName || null,
            location: doc.location || null,
            geo: doc.geo || 'Unknown',
            content: doc.description || doc.markdown || doc.content || '',
            url: doc.url || null,
            publishedAt: publishedAt,
            updatedAt: doc.updatedAt || new Date().toISOString()
          };

          const targetIndex = getIndexName(site);
          await meili.addDocuments(targetIndex, [meiliDoc]);
          Logger.info(`[Indexer] Successfully indexed to Meilisearch for [${site}] ID: ${id}`);

        } catch (err: any) {
          Logger.error(`[Indexer] Indexing failed for [${site}] ID: ${id} on attempt ${attempt}`, err);

          if (attempt < 3) {
            const retryTask = { site, id, attempt: attempt + 1 };
            await redis.rpush(INDEX_QUEUE, JSON.stringify(retryTask));
            Logger.info(`[Indexer] Re-queued task to retry. Attempt: ${attempt + 1}`);
          } else {
            const deadTask = { site, id, error: err.message, failedAt: new Date().toISOString() };
            await redis.rpush(DEAD_LETTER_QUEUE, JSON.stringify(deadTask));
            Logger.error(`[Indexer] Max retry attempts exceeded. Moved index ID: ${id} to dead_letter_queue`);
          }
        }
      });

    } catch (loopErr: any) {
      Logger.error(`[Indexer] Worker loop exception: ${loopErr.message}`, loopErr);
    }
  }
}

main().catch((err) => {
  Logger.error('Fatal crash on Indexer Worker', err);
  process.exit(1);
});
