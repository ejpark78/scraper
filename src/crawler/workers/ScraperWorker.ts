import * as os from 'os';
import Redis from 'ioredis';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { MongoDatabase } from '../../database/mongo';
import { UrlUtils, Logger } from '../utils';
const { stripTrackingParams, isBinaryUrl, extractDomainUrl } = UrlUtils;
import { getSite, getAllSites } from '../core/SiteRegistry';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const SCRAPE_QUEUE = 'scrape_queue';
const TRANSFORM_QUEUE = 'transform_queue';
const ACTIVE_PROCESSING_SET = 'active_processing';
const DEAD_LETTER_QUEUE = 'dead_letter_queue';

interface ScrapePayload {
  site: string;
  url: string;
  attempt: number;
  priority?: 'high' | 'medium' | 'low';
  scraperSlack?: number;
  recursive?: boolean;
}

class ScraperDispatcher {
  public async scrape(site: string, url: string, tempPath: string): Promise<void> {
    const desc = getSite(site);
    if (!desc?.scraper) {
      throw new Error(`Unsupported site scraper: ${site}`);
    }
    await desc.scraper.scrape(url, tempPath);
  }
}

class QueueManager {
  private scrapeSiteKeys: string[];
  private highQueues: string[];
  private mediumQueues: string[];
  private lowQueues: string[];
  private legacyQueues = ['scrape_queue'];

  constructor() {
    this.scrapeSiteKeys = getAllSites().filter(s => s.scraper).map(s => s.key);
    this.highQueues = this.buildQueues('high');
    this.mediumQueues = this.buildQueues('medium');
    this.lowQueues = this.buildQueues('low');
  }

  private buildQueues(priority: string): string[] {
    return this.scrapeSiteKeys.map(key => `scrape_queue:${key}:${priority}`);
  }

  public getActiveQueues(): string[] {
    return [
      ...this.shuffleArray(this.highQueues),
      ...this.shuffleArray(this.mediumQueues),
      ...this.shuffleArray(this.lowQueues),
      ...this.legacyQueues,
    ];
  }

  private shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

class ScraperWorker {
  private redis: Redis;
  private mongo: MongoDatabase;
  private dispatcher: ScraperDispatcher;
  private queueManager: QueueManager;

  constructor() {
    this.redis = new Redis(REDIS_URL);
    this.mongo = MongoDatabase.getInstance();
    this.dispatcher = new ScraperDispatcher();
    this.queueManager = new QueueManager();
  }

  public async start(): Promise<void> {
    Logger.info(`Connecting to Redis at ${REDIS_URL}...`);
    await this.mongo.connect();
    Logger.info(`Scraper Worker started, listening to: ${SCRAPE_QUEUE}`);

    while (true) {
      try {
        const activeQueues = this.queueManager.getActiveQueues();
        const res = await this.redis.blpop(...activeQueues, 5);
        if (!res) continue;

        const queueName = res[0];
        const payloadRaw = res[1].trim();
        if (!payloadRaw) continue;

        await this.processMessage(queueName, payloadRaw);
      } catch (loopErr: any) {
        Logger.error(`[Scraper] Worker loop exception: ${loopErr.message}`, loopErr);
      }
    }
  }

  private async processMessage(queueName: string, payloadRaw: string): Promise<void> {
    let payload: ScrapePayload;
    try {
      payload = JSON.parse(payloadRaw);
    } catch (err) {
      payload = { site: 'linkedin', url: payloadRaw, attempt: 1 };
    }

    const { site, url, scraperSlack } = payload;
    const desc = getSite(site);

    if (!desc?.scraper) {
      Logger.error(`Unsupported site payload received: ${site}`, { url });
      return;
    }

    const config = desc.scraper;

    if (desc.domain) {
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== desc.domain && !parsed.hostname.endsWith(`.${desc.domain}`)) {
          Logger.warn(`[Scraper] Skipping URL outside configured domain for [${site}]: ${url} (hostname: ${parsed.hostname})`);
          return;
        }
      } catch {
        Logger.error(`[Scraper] Invalid URL for [${site}]: ${url}`);
        return;
      }
    }

    const id = config.extractId(url);
    if (!id) {
      Logger.error(`Invalid URL pattern. Cannot extract ID for site: ${site}`, { url });
      return;
    }

    Logger.info(`[Scraper] POP target [${site}] ID: ${id} from queue: ${queueName}`, { url, queue: queueName });

    const tempHtmlPath = path.join(os.tmpdir(), `temp_raw_${site}_${id}.html`);
    try {
      await this.checkAndApplyRateLimit(site, scraperSlack);
      await this.dispatcher.scrape(site, url, tempHtmlPath);

      if (!fs.existsSync(tempHtmlPath) || fs.statSync(tempHtmlPath).size === 0) {
        throw new Error('Downloaded raw HTML content is empty.');
      }

      const rawHtml = fs.readFileSync(tempHtmlPath, 'utf-8');
      fs.unlinkSync(tempHtmlPath);

      this.logHtmlPreview(site, id, rawHtml);
      await this.saveRawHtmlAndQueueTransform(site, id, url, rawHtml, payload);
    } catch (scrapeErr: any) {
      await this.handleScrapeFailure(payload, id, scrapeErr);
    }
  }

  private async checkAndApplyRateLimit(site: string, scraperSlack?: number): Promise<void> {
    const desc = getSite(site);
    const defaultSlack = desc?.scraper?.defaultSlack ?? 3;
    const slackSeconds = scraperSlack !== undefined ? scraperSlack : defaultSlack;
    if (slackSeconds <= 0) return;

    const now = Date.now();
    const rateLimitKey = `last_scrape_time:${site}`;
    const lastScrapeTimeRaw = await this.redis.get(rateLimitKey);
    const lastScrapeTime = lastScrapeTimeRaw ? parseInt(lastScrapeTimeRaw, 10) : 0;

    const minInterval = slackSeconds * 1000;
    const timePassed = now - lastScrapeTime;

    if (timePassed < minInterval) {
      const delay = minInterval - timePassed;
      Logger.info(`[Scraper] [${site}] Rate-limit active. Delaying for ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    await this.redis.set(rateLimitKey, Date.now().toString());
  }

  private logHtmlPreview(site: string, id: string, rawHtml: string): void {
    try {
      const $ = cheerio.load(rawHtml);
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 500);
      Logger.info(`[Scraper] HTML Content Preview [${site}] ID: ${id} (First 500 chars of body text): "${bodyText}"`);
    } catch (logErr) {
    }
  }

  private async saveRawHtmlAndQueueTransform(
    site: string,
    id: string,
    url: string,
    rawHtml: string,
    payload?: ScrapePayload
  ): Promise<void> {
    const desc = getSite(site);
    if (!desc?.scraper) {
      throw new Error(`Configuration not found for site: ${site}`);
    }

    const config = desc.scraper;
    const collection = await this.mongo.getCollection(config.collectionName);
    const updateFilter = { [config.updateFilterKey]: id };
    const updatePayload = {
      ...updateFilter,
      id,
      url,
      rawHtml,
      scrapedAt: new Date(),
    };

    const updateResult = await collection.updateOne(
      updateFilter,
      { $set: updatePayload },
      { upsert: true }
    );

    const dbRefId = updateResult.upsertedId ? updateResult.upsertedId.toString() : id;

    const transformTask = {
      site,
      id,
      bronze_db: 'bronze',
      bronze_collection: config.targetCollection,
      bronze_id: dbRefId,
      timestamp: new Date().toISOString(),
    };

    await this.redis.rpush(TRANSFORM_QUEUE, JSON.stringify(transformTask));
    Logger.info(`[Scraper] Successfully saved Raw HTML and published transform event for ID: ${id}`);

    if (payload?.recursive === true) {
      if (desc.domain && config.urlsCollectionName) {
        await this.discoverRecursiveUrls(site, url, rawHtml);
      }
    }
  }

  private async discoverRecursiveUrls(site: string, currentUrl: string, html: string): Promise<void> {
    try {
      const desc = getSite(site);
      if (!desc?.scraper) return;
      const config = desc.scraper;
      if (!desc.domain || !config.urlsCollectionName) return;

      const $ = cheerio.load(html);
      const urlsColl = await this.mongo.getCollection(config.urlsCollectionName as `${'bronze' | 'silver'}/${string}`);
      let discoveredCount = 0;
      const priority = process.env.PRIORITY || 'medium';

      const links = $('a[href]').toArray();
      for (const link of links) {
        const href = $(link).attr('href');
        if (!href) continue;

        let fullUrl: string;
        try {
          fullUrl = new URL(href, currentUrl).toString();
          const parsed = new URL(fullUrl);
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
          if (parsed.hostname !== desc.domain && !parsed.hostname.endsWith(`.${desc.domain}`)) {
            const extracted = extractDomainUrl(fullUrl, desc.domain);
            if (!extracted) continue;
            fullUrl = extracted;
          }
        } catch { continue; }
        fullUrl = stripTrackingParams(fullUrl).split('#')[0];
        if (isBinaryUrl(fullUrl)) continue;
        const id = config.extractId(fullUrl);

        const doc = await urlsColl.findOne({ id });
        const isCompleted = doc?.status === 'completed';
        const isFailed = doc?.status === 'failed';
        const alreadyPushed = doc?.pushedToRedis || false;

        if (!isCompleted && !isFailed && !alreadyPushed) {
          const redisPayload = JSON.stringify({
            site,
            url: fullUrl,
            attempt: 1,
            priority: priority,
          });

          await this.redis.rpush(`scrape_queue:${site}:${priority}`, redisPayload);
          await urlsColl.updateOne({ id }, {
            $set: {
              id,
              url: fullUrl,
              status: 'new',
              pushedToRedis: true,
              updatedAt: new Date(),
            },
          }, { upsert: true });
          discoveredCount++;
        }
      }
      if (discoveredCount > 0) {
        Logger.info(`[Scraper] [Recursive] Discovered and queued ${discoveredCount} new links from [${site}] content.`);
      }
    } catch (err: any) {
      Logger.error(`[Scraper] Error during recursive discovery for [${site}]: ${err.message}`);
    }
  }

  private async handleScrapeFailure(
    payload: ScrapePayload,
    id: string,
    scrapeErr: any
  ): Promise<void> {
    const { site, url, attempt, scraperSlack } = payload;
    Logger.error(`[Scraper] Scrape execution failed for [${site}] ID: ${id} on attempt ${attempt}`, scrapeErr);

    if (attempt < 3) {
      const priority = payload.priority || 'medium';
      const retryTask: ScrapePayload = {
        site,
        url,
        attempt: attempt + 1,
        priority,
        ...(scraperSlack !== undefined ? { scraperSlack } : {}),
      };
      const targetQueue = `scrape_queue:${site}:${priority}`;

      if (priority === 'high') {
        await this.redis.lpush(targetQueue, JSON.stringify(retryTask));
      } else {
        await this.redis.rpush(targetQueue, JSON.stringify(retryTask));
      }
      Logger.info(`[Scraper] Re-queued task to ${targetQueue} retry. Attempt: ${attempt + 1}`);
    } else {
      const deadTask = { site, url, error: scrapeErr.message, failedAt: new Date().toISOString() };
      await this.redis.rpush(DEAD_LETTER_QUEUE, JSON.stringify(deadTask));
      await this.redis.srem(ACTIVE_PROCESSING_SET, url);
      const desc = getSite(site);
      if (desc?.scraper?.urlsCollectionName) {
        const urlsColl = await this.mongo.getCollection(desc.scraper.urlsCollectionName as `${'bronze' | 'silver'}/${string}`);
        await urlsColl.updateOne(
          { id },
          { $set: { status: 'failed', failedAt: new Date(), error: scrapeErr.message } },
          { upsert: true }
        );
      }
      Logger.error(`[Scraper] Max retry attempts exceeded. Moved ID: ${id} to dead_letter_queue and marked as failed in urls`);
    }

    if (scrapeErr.message && (scrapeErr.message.includes('세션 만료') || scrapeErr.message.includes('Auth Wall'))) {
      Logger.error(`LinkedIn Session expired. Graceful shut down of scraper.`, scrapeErr);
      await this.redis.quit();
      process.exit(1);
    }
  }
}

const worker = new ScraperWorker();
worker.start().catch((err) => {
  Logger.error('Fatal crash on Scraper Worker', err);
  process.exit(1);
});
