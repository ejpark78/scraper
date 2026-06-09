import * as os from 'os';
import Redis from 'ioredis';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { MongoDatabase } from '../database/mongo';
import { LinkedInCrawler } from '../sites/linkedin/Crawler';
import { UrlUtils, Logger } from '../utils';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const SCRAPE_QUEUE = 'scrape_queue';
const TRANSFORM_QUEUE = 'transform_queue';
const ACTIVE_PROCESSING_SET = 'active_processing';
const DEAD_LETTER_QUEUE = 'dead_letter_queue';

interface SiteScraperConfig {
  collectionName: `bronze/${string}`;
  targetCollection: string;
  updateFilterKey: string;
  defaultSlack: number;
  extractId: (url: string) => string;
}

const SITE_CONFIGS: Record<string, SiteScraperConfig> = {
  linkedin: {
    collectionName: 'bronze/linkedin.jobs',
    targetCollection: 'linkedin.jobs',
    updateFilterKey: 'jobId',
    defaultSlack: 0,
    extractId: (url) => UrlUtils.extractJobId(url) || '',
  },
  geeknews: {
    collectionName: 'bronze/geeknews.html',
    targetCollection: 'geeknews.html',
    updateFilterKey: 'topicId',
    defaultSlack: 3,
    extractId: (url) => {
      if (url.includes('id=')) {
        return url.split('id=').pop()!.split('&')[0];
      }
      return '';
    },
  },
  pytorch_kr: {
    collectionName: 'bronze/pytorch_kr.html',
    targetCollection: 'pytorch_kr.html',
    updateFilterKey: 'topicId',
    defaultSlack: 3,
    extractId: (url) => {
      const match = url.match(/\/(\d+)(?:\?|$)/);
      return match ? match[1] : '';
    },
  },
  gpters: {
    collectionName: 'bronze/gpters.html',
    targetCollection: 'gpters.html',
    updateFilterKey: 'postId',
    defaultSlack: 3,
    extractId: (url) => {
      const parts = url.split('-');
      return parts[parts.length - 1] || '';
    },
  },
  gpters_newsletter: {
    collectionName: 'bronze/gpters_newsletter.html',
    targetCollection: 'gpters_newsletter.html',
    updateFilterKey: 'id',
    defaultSlack: 3,
    extractId: (url) => {
      const parts = url.split('-');
      return parts[parts.length - 1] || '';
    },
  },
  aicasebook: {
    collectionName: 'bronze/aicasebook.html',
    targetCollection: 'aicasebook.html',
    updateFilterKey: 'id',
    defaultSlack: 3,
    extractId: (url) => {
      const match = url.match(/\/setup\/(\d+)/);
      return match ? match[1] : '';
    },
  },
};

interface ScrapePayload {
  site: string;
  url: string;
  attempt: number;
  priority?: 'high' | 'medium' | 'low';
  scraperSlack?: number;
}

class ScraperDispatcher {
  private linkedinCrawler = new LinkedInCrawler({
    login: process.env.LOGIN === 'true' || process.env.AUTH === 'true',
  });

  public async scrape(site: string, url: string, tempPath: string): Promise<void> {
    switch (site) {
      case 'linkedin':
        await this.linkedinCrawler.scrapeJob(url, tempPath);
        break;
      case 'geeknews':
        await this.scrapeHttpFetch(url, tempPath);
        break;
      case 'gpters':
      case 'gpters_newsletter':
        await this.scrapeGpters(url, tempPath);
        break;
      case 'pytorch_kr':
        await this.scrapePytorchKr(url, tempPath);
        break;
      case 'aicasebook':
        await this.scrapeHttpFetch(url, tempPath);
        break;
      default:
        throw new Error(`Unsupported site scraper: ${site}`);
    }
  }

  private extractIdFromGptersUrl(url: string): string {
    const parts = url.split('-');
    return parts[parts.length - 1] || '';
  }

  private async scrapeHttpFetch(url: string, tempPath: string): Promise<void> {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP status ${response.status} when scraping ${url}`);
    }
    const html = await response.text();
    fs.writeFileSync(tempPath, html, 'utf-8');
  }

  private async fetchGptersGuestToken(): Promise<string> {
    const res = await fetch('https://www.gpters.org/news');
    const html = await res.text();
    const match = html.match(/accessToken":"([^"]+)"/);
    if (!match) {
      throw new Error('Failed to extract GPTERS guest access token from homepage');
    }
    return match[1];
  }

  private async scrapeGpters(url: string, tempPath: string): Promise<void> {
    const id = this.extractIdFromGptersUrl(url);
    console.log(`🌐 [GPTERS] Fetching guest access token...`);
    const token = await this.fetchGptersGuestToken();
    console.log(`🔑 [GPTERS] Fetching GraphQL API for ID: ${id} ...`);
    const query = `
query getPost($id: ID!) {
  post(id: $id) {
    id
    title
    slug
    createdAt
    publishedAt
    createdBy { member { name } }
    reactionsCount
    repliesCount
    shortContent
    fields { key value }
    space { id name slug }
  }
}`;
    const response = await fetch('https://api.bettermode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({ query, variables: { id } })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`GPTERS GraphQL HTTP status ${response.status} for ID ${id}: ${body.slice(0, 200)}`);
    }
    const resJson = await response.json();
    const post = resJson.data?.post;
    if (!post) {
      throw new Error(`GPTERS post ID ${id} not found in GraphQL response`);
    }
    fs.writeFileSync(tempPath, JSON.stringify(post), 'utf-8');
  }

  private async scrapePytorchKr(url: string, tempPath: string): Promise<void> {
    const jsonUrl = url.includes('.json') ? url : `${url}.json`;
    console.log(`🌐 [PyTorch KR] Fetching JSON API: ${jsonUrl} ...`);
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
    });
    if (!response.ok) {
      throw new Error(`PyTorch KR JSON API HTTP status ${response.status} when scraping ${url}`);
    }

    const data = await response.json();
    const title: string = data.title || 'Unknown Title';
    const createdAt: string = data.created_at || '';
    const cooked: string = data.post_stream?.posts?.[0]?.cooked || '';

    if (!cooked) {
      throw new Error(`No cooked content in JSON API response for ${url}`);
    }

    const html = `<!DOCTYPE html>
<html>
<head><title>${title.replace(/</g, '&lt;')} - PyTorchKR</title>
<link rel="canonical" href="${url}">
<meta property="article:published_time" content="${createdAt}">
</head>
<body>
<div class="post" itemprop="text">${cooked}</div>
</body>
</html>`;

    fs.writeFileSync(tempPath, html, 'utf-8');
  }
}

class QueueManager {
  private highQueues = [
    'scrape_queue:linkedin:high',
    'scrape_queue:geeknews:high',
    'scrape_queue:gpters:high',
    'scrape_queue:gpters_newsletter:high',
    'scrape_queue:pytorch_kr:high',
    'scrape_queue:aicasebook:high',
  ];

  private mediumQueues = [
    'scrape_queue:linkedin:medium',
    'scrape_queue:geeknews:medium',
    'scrape_queue:gpters:medium',
    'scrape_queue:gpters_newsletter:medium',
    'scrape_queue:pytorch_kr:medium',
    'scrape_queue:aicasebook:medium',
  ];

  private lowQueues = [
    'scrape_queue:linkedin:low',
    'scrape_queue:geeknews:low',
    'scrape_queue:gpters:low',
    'scrape_queue:gpters_newsletter:low',
    'scrape_queue:pytorch_kr:low',
    'scrape_queue:aicasebook:low',
  ];

  private legacyQueues = ['scrape_queue'];

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
      // Fallback for raw string URL representing linkedin
      payload = { site: 'linkedin', url: payloadRaw, attempt: 1 };
    }

    const { site, url, scraperSlack } = payload;
    const config = SITE_CONFIGS[site];

    if (!config) {
      Logger.error(`Unsupported site payload received: ${site}`, { url });
      return;
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
      await this.saveRawHtmlAndQueueTransform(site, id, url, rawHtml);
    } catch (scrapeErr: any) {
      await this.handleScrapeFailure(payload, id, scrapeErr);
    }
  }

  private async checkAndApplyRateLimit(site: string, scraperSlack?: number): Promise<void> {
    const config = SITE_CONFIGS[site];
    const defaultSlack = config ? config.defaultSlack : 3;
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
      // Ignore log errors
    }
  }

  private async saveRawHtmlAndQueueTransform(
    site: string,
    id: string,
    url: string,
    rawHtml: string
  ): Promise<void> {
    const config = SITE_CONFIGS[site];
    if (!config) {
      throw new Error(`Configuration not found for site: ${site}`);
    }

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
      Logger.error(`[Scraper] Max retry attempts exceeded. Moved ID: ${id} to dead_letter_queue`);
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
