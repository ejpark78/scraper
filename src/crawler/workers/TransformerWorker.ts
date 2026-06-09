import * as os from 'os';
import Redis from 'ioredis';
import { MongoDatabase } from '../../database/mongo';
import { UrlUtils, NamingUtils, Logger } from '../utils';

// Converters
import { LinkedInMarkdownConverter } from '../sites/linkedin/jobs/Converter';
import { CompanyMarkdownConverter } from '../sites/linkedin/company/Converter';
import { GeekNewsConverter } from '../sites/geeknews/Converter';
import { GptersConverter } from '../sites/gpters/Converter';
import { PyTorchKRConverter } from '../sites/pytorch_kr/Converter';
import { AiCasebookConverter } from '../sites/aicasebook/Converter';
import { DailyDoseDSConverter } from '../sites/dailydoseofds/Converter';

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
  private static aicasebook = new AiCasebookConverter();
  private static dailydose = new DailyDoseDSConverter();

  public static getConverter(site: string): any {
    if (site === 'linkedin') return this.linkedinJobs;
    if (site === 'linkedin_company') return this.linkedinCompany;
    if (site === 'geeknews') return this.geeknews;
    if (site === 'gpters' || site === 'gpters_newsletter') return this.gpters;
    if (site === 'pytorch_kr') return this.pytorch;
    if (site === 'aicasebook') return this.aicasebook;
    if (site === 'dailydose_ds') return this.dailydose;
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

      const task: { site: string; id: string; bronze_db?: string; bronze_collection?: string; bronze_id: string; attempt?: number } = JSON.parse(payloadRaw);
      const { site, id, bronze_id } = task;
      const attempt = task.attempt || 1;

      Logger.info(`[Transformer] POP task [${site}] ID: ${id} (Bronze Ref: ${bronze_id})`);

      try {
        // Fetch raw HTML from MongoDB Bronze Layer (Collection: site.html or site.jobs)
        const dbName = task.bronze_db || 'bronze';
        let collectionName = task.bronze_collection;
        if (!collectionName) {
          // Fallback if queue task format is old
          collectionName = site === 'linkedin' ? 'linkedin.jobs' : `${site}.html`;
        }
        
        // MongoDatabase.getCollection은 'dbName/collectionName' 구조가 들어오면 이를 지원하므로 아래와 같이 패스를 구성합니다.
        const pathSpec = `${dbName}/${collectionName}` as `${'bronze' | 'silver'}/${string}`;
        const bronzeColl = await mongo.getCollection(pathSpec);
        
        const filter = site === 'linkedin' ? { jobId: id } : site === 'geeknews' ? { topicId: id } : site === 'gpters' ? { $or: [{ postId: id }, { id: id }] } : site === 'gpters_newsletter' ? { id } : site === 'pytorch_kr' ? { $or: [{ topicId: id }, { id: id }] } : site === 'aicasebook' ? { id } : site === 'dailydose_ds' ? { id } : { topicId: id };
        const rawDoc = await bronzeColl.findOne(filter);

        if (!rawDoc) {
          throw new Error(`Raw document not found in ${pathSpec} for ID ${id}`);
        }

        // Accept rawHtml (new) or rawJson (legacy) for gpters
        let rawContent: string;
        if (rawDoc.rawHtml) {
          rawContent = rawDoc.rawHtml;
        } else if (rawDoc.rawJson) {
          rawContent = typeof rawDoc.rawJson === 'string' ? rawDoc.rawJson : JSON.stringify(rawDoc.rawJson);
        } else {
          throw new Error(`No rawHtml or rawJson found in ${pathSpec} for ID ${id}`);
        }

        // Run Transform
        const converter = ConverterFactory.getConverter(site);
        let meta = converter.convertHtmlToMarkdown(rawContent, id, rawDoc.url || '');

        // Fallback: for pytorch_kr, try JSON API when content is empty (old SPA bronze data)
        if (site === 'pytorch_kr' && (!meta.content?.trim() || meta.content === `${meta.title}\n`)) {
          Logger.info(`[Transformer] Content empty for [${site}] ID: ${id}, trying JSON API fallback...`);
          const jsonMeta = await converter.fetchAndConvertFromJsonApi(rawDoc.url, id);
          if (jsonMeta) {
            meta = jsonMeta;
            Logger.info(`[Transformer] JSON API fallback succeeded for [${site}] ID: ${id}`);
          }
        }

        // Run Load (TBD Target PostgreSQL Layer)
        await TargetLoader.load(site, id, meta);

        // Update status collections if applicable
        if (site === 'geeknews' || site === 'gpters' || site === 'gpters_newsletter' || site === 'pytorch_kr' || site === 'aicasebook') {
          const urlsCollName = `bronze/${site}.urls` as `${'bronze' | 'silver'}/${string}`;
          const urlsColl = await mongo.getCollection(urlsCollName);
          await urlsColl.updateOne(
            { id },
            { $set: { status: 'completed', updatedAt: new Date() } }
          );
        } else if (site === 'linkedin') {
          const jobUrlsColl = await mongo.getCollection('bronze/linkedin.job_urls');
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
        const cacheSetKey = site === 'linkedin' ? 'completed_jobs' : site === 'gpters_newsletter' ? 'completed_gpters_newsletter' : site === 'aicasebook' ? 'completed_aicasebook' : 'completed_news';
        await redis.sadd(cacheSetKey, id);

        Logger.info(`[Transformer] Successfully completed pipeline for [${site}] ID: ${id}`, {
          title: meta.jobTitle || meta.title || 'Untitled',
          company: meta.company || meta.companyName || 'N/A',
          location: meta.rawLocation || meta.location || 'N/A',
          url: rawDoc.url || ''
        });

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
