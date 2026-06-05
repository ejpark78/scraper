import * as os from 'os';
import Redis from 'ioredis';
import { MongoDatabase } from './database/mongo';
import { LinkedInCrawler } from './Crawler';
import { UrlUtils, Logger } from './utils';
import * as fs from 'fs';
import * as path from 'path';

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
const SCRAPE_QUEUE = 'scrape_queue';
const TRANSFORM_QUEUE = 'transform_queue';
const ACTIVE_PROCESSING_SET = 'active_processing';
const DEAD_LETTER_QUEUE = 'dead_letter_queue';

// Scrape engines mapping
class ScraperDispatcher {
  private linkedinCrawler = new LinkedInCrawler({ login: process.env.LOGIN === 'true' || process.env.AUTH === 'true' });

  public async scrape(site: string, url: string, tempPath: string): Promise<void> {
    if (site === 'linkedin') {
      await this.linkedinCrawler.scrapeJob(url, tempPath);
    } else if (site === 'geeknews') {
      await this.scrapeHttpFetch(url, tempPath);
    } else if (site === 'gpters' || site === 'pytorch_kr') {
      // For forums/simple static fetch
      await this.scrapeHttpFetch(url, tempPath);
    } else {
      throw new Error(`Unsupported site scraper: ${site}`);
    }
  }

  private async scrapeHttpFetch(url: string, tempPath: string): Promise<void> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP status ${response.status} when scraping ${url}`);
    }
    const html = await response.text();
    fs.writeFileSync(tempPath, html, 'utf-8');
  }
}

function extractIdFromUrl(site: string, url: string): string {
  if (site === 'linkedin') {
    return UrlUtils.extractJobId(url) || '';
  } else if (site === 'geeknews') {
    if (url.includes('id=')) return url.split('id=').pop()!.split('&')[0];
  } else if (site === 'pytorch_kr') {
    const match = url.match(/\/(\d+)(?:\?|$)/);
    if (match) return match[1];
  } else if (site === 'gpters') {
    const parts = url.split('-');
    return parts[parts.length - 1] || '';
  }
  return '';
}

async function main() {
  Logger.info(`Connecting to Redis at ${REDIS_URL}...`);
  const redis = new Redis(REDIS_URL);
  const mongo = MongoDatabase.getInstance();
  await mongo.connect();

  const dispatcher = new ScraperDispatcher();
  Logger.info(`Scraper Worker started, listening to: ${SCRAPE_QUEUE}`);

  while (true) {
    try {
      const res = await redis.blpop(SCRAPE_QUEUE, 5);
      if (!res) continue;

      const payloadRaw = res[1].trim();
      if (!payloadRaw) continue;

      let payload: { site: string; url: string; attempt: number };
      try {
        payload = JSON.parse(payloadRaw);
      } catch (err) {
        // Fallback for raw string URL representing linkedin
        payload = { site: 'linkedin', url: payloadRaw, attempt: 1 };
      }

      const { site, url, attempt } = payload;
      const id = extractIdFromUrl(site, url);

      if (!id) {
        Logger.error(`Invalid URL pattern. Cannot extract ID for site: ${site}`, { url });
        continue;
      }

      Logger.info(`[Scraper] POP target [${site}] ID: ${id}`, { url });

      // Run Scraping
      const tempHtmlPath = path.join(os.tmpdir(), `temp_raw_${site}_${id}.html`);
      try {
        await dispatcher.scrape(site, url, tempHtmlPath);

        if (!fs.existsSync(tempHtmlPath) || fs.statSync(tempHtmlPath).size === 0) {
          throw new Error('Downloaded raw HTML content is empty.');
        }

        const rawHtml = fs.readFileSync(tempHtmlPath, 'utf-8');
        fs.unlinkSync(tempHtmlPath);

        // Save Raw to MongoDB Bronze Layer (Collection: site.html)
        const collectionName = `${site}.html`;
        const bronzeColl = await mongo.getCollection(collectionName);

        const updateFilter = site === 'linkedin' ? { jobId: id } : site === 'geeknews' ? { topicId: id } : site === 'gpters' ? { postId: id } : { topicId: id };
        const updatePayload = {
          ...updateFilter,
          url,
          rawHtml,
          scrapedAt: new Date()
        };

        const updateResult = await bronzeColl.updateOne(
          updateFilter,
          { $set: updatePayload },
          { upsert: true }
        );

        const dbRefId = updateResult.upsertedId ? updateResult.upsertedId.toString() : id;

        // Push task to transform_queue
        const transformTask = {
          site,
          id,
          bronze_id: dbRefId,
          timestamp: new Date().toISOString()
        };
        await redis.rpush(TRANSFORM_QUEUE, JSON.stringify(transformTask));
        Logger.info(`[Scraper] Successfully saved Raw HTML and published transform event for ID: ${id}`);

      } catch (scrapeErr: any) {
        Logger.error(`[Scraper] Scrape execution failed for [${site}] ID: ${id} on attempt ${attempt}`, scrapeErr);

        if (attempt < 3) {
          // Re-queue task to scrape_queue
          const retryTask = { site, url, attempt: attempt + 1 };
          await redis.rpush(SCRAPE_QUEUE, JSON.stringify(retryTask));
          Logger.info(`[Scraper] Re-queued task to retry. Attempt: ${attempt + 1}`);
        } else {
          // Push to Dead Letter Queue
          const deadTask = { site, url, error: scrapeErr.message, failedAt: new Date().toISOString() };
          await redis.rpush(DEAD_LETTER_QUEUE, JSON.stringify(deadTask));
          // Remove from active processing set to unlock future scheduling
          await redis.srem(ACTIVE_PROCESSING_SET, url);
          Logger.error(`[Scraper] Max retry attempts exceeded. Moved ID: ${id} to dead_letter_queue`);
        }

        // Graceful handle Auth Walls
        if (scrapeErr.message && (scrapeErr.message.includes('세션 만료') || scrapeErr.message.includes('Auth Wall'))) {
          Logger.error(`LinkedIn Session expired. Graceful shut down of scraper.`, scrapeErr);
          await redis.quit();
          process.exit(1);
        }
      }

    } catch (loopErr: any) {
      Logger.error(`[Scraper] Worker loop exception: ${loopErr.message}`, loopErr);
    }
  }
}

main().catch((err) => {
  Logger.error('Fatal crash on Scraper Worker', err);
  process.exit(1);
});
