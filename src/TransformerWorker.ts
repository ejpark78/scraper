import * as os from 'os';
import Redis from 'ioredis';
import { MongoDatabase } from './database/mongo';
import { UrlUtils, NamingUtils, Logger } from './utils';

// Converters
import { LinkedInMarkdownConverter } from './sites/linkedin/jobs/Converter';
import { CompanyMarkdownConverter } from './sites/linkedin/company/Converter';
import { GeekNewsConverter } from './sites/geeknews/Converter';
import { GptersConverter } from './sites/gpters/Converter';
import { PyTorchKRConverter } from './sites/pytorch_kr/Converter';

// JSON Log structured console override if configured
if (process.env.JSON_LOG === 'true') {
  const originalLog = console.log;
  const originalError = console.error;
  const hostname = os.hostname();
  const formatLog = (level: string, args: any[]) => {
    const timestamp = new Date().toISOString();
    return JSON.stringify({ timestamp, level, hostname, message: args.join(' ') });
  };
  console.log = (...args) => originalLog(formatLog('INFO', args));
  console.error = (...args) => originalError(formatLog('ERROR', args));
}

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const TRANSFORM_QUEUE = 'transform_queue';
const ACTIVE_PROCESSING_SET = 'active_processing';
const DEAD_LETTER_QUEUE = 'dead_letter_queue';

// Factory pattern for Converters
class ConverterFactory {
  private static linkedinJobs = new LinkedInMarkdownConverter();
  private static linkedinCompany = new CompanyMarkdownConverter();
  private static geeknews = new GeekNewsConverter();
  private static gpters = new GptersConverter();
  private static pytorch = new PyTorchKRConverter();

  public static getConverter(site: string): any {
    if (site === 'linkedin') return this.linkedinJobs;
    if (site === 'linkedin_company') return this.linkedinCompany;
    if (site === 'geeknews') return this.geeknews;
    if (site === 'gpters') return this.gpters;
    if (site === 'pytorch_kr') return this.pytorch;
    throw new Error(`Unsupported converter site type: ${site}`);
  }
}

import { TargetLoader } from './TargetLoader';

async function main() {
  Logger.info(`Connecting to Redis at ${REDIS_URL}...`);
  const redis = new Redis(REDIS_URL);
  const mongo = MongoDatabase.getInstance();
  await mongo.connect();

  Logger.info(`Transformer Worker started, listening to: ${TRANSFORM_QUEUE}`);

  while (true) {
    try {
      const res = await redis.blpop(TRANSFORM_QUEUE, 5);
      if (!res) continue;

      const payloadRaw = res[1].trim();
      if (!payloadRaw) continue;

      const task: { site: string; id: string; bronze_id: string; attempt?: number } = JSON.parse(payloadRaw);
      const { site, id, bronze_id } = task;
      const attempt = task.attempt || 1;

      Logger.info(`[Transformer] POP task [${site}] ID: ${id} (Bronze Ref: ${bronze_id})`);

      try {
        // Fetch raw HTML from MongoDB Bronze Layer (Collection: site.html)
        const collectionName = `${site}.html`;
        const bronzeColl = await mongo.getCollection(collectionName);
        
        const filter = site === 'linkedin' ? { jobId: id } : site === 'geeknews' ? { topicId: id } : site === 'gpters' ? { postId: id } : { topicId: id };
        const rawDoc = await bronzeColl.findOne(filter);

        if (!rawDoc || !rawDoc.rawHtml) {
          throw new Error(`Raw HTML document not found in ${collectionName} for ID ${id}`);
        }

        // Run Transform
        const converter = ConverterFactory.getConverter(site);
        const meta = converter.convertHtmlToMarkdown(rawDoc.rawHtml, id, rawDoc.url || '');

        // Run Load (TBD Target PostgreSQL Layer)
        await TargetLoader.load(site, id, meta);

        // Update status collections if applicable
        if (site === 'geeknews' || site === 'gpters' || site === 'pytorch_kr') {
          const urlsCollName = `${site}.urls`;
          const urlsColl = await mongo.getCollection(urlsCollName);
          await urlsColl.updateOne(
            { id },
            { $set: { status: 'completed', updatedAt: new Date() } }
          );
        } else if (site === 'linkedin') {
          const jobUrlsColl = await mongo.getCollection('linkedin.job_urls');
          await jobUrlsColl.updateOne(
            { jobId: id },
            { $set: { status: 'completed', updatedAt: new Date() } }
          );
        }

        // SREM active processing to unlock future schedules
        const cacheUrl = rawDoc.url || '';
        if (cacheUrl) {
          await redis.srem(ACTIVE_PROCESSING_SET, cacheUrl);
        }

        // Add to completed lists if applicable
        const cacheSetKey = site === 'linkedin' ? 'completed_jobs' : 'completed_news';
        await redis.sadd(cacheSetKey, id);

        Logger.info(`[Transformer] Successfully completed pipeline for [${site}] ID: ${id}`);

      } catch (transErr: any) {
        Logger.error(`[Transformer] Transformation failed for [${site}] ID: ${id} on attempt ${attempt}`, transErr);

        if (attempt < 3) {
          // Re-queue task to transform_queue
          const retryTask = { site, id, bronze_id, attempt: attempt + 1 };
          await redis.rpush(TRANSFORM_QUEUE, JSON.stringify(retryTask));
          Logger.info(`[Transformer] Re-queued task to retry. Attempt: ${attempt + 1}`);
        } else {
          // Push to Dead Letter Queue
          const deadTask = { site, id, bronze_id, error: transErr.message, failedAt: new Date().toISOString() };
          await redis.rpush(DEAD_LETTER_QUEUE, JSON.stringify(deadTask));
          Logger.error(`[Transformer] Max retry attempts exceeded. Moved transform ID: ${id} to dead_letter_queue`);
        }
      }

    } catch (loopErr: any) {
      Logger.error(`[Transformer] Worker loop exception: ${loopErr.message}`, loopErr);
    }
  }
}

main().catch((err) => {
  Logger.error('Fatal crash on Transformer Worker', err);
  process.exit(1);
});
