import { MongoDatabase } from '../../database/mongo';
import Redis from 'ioredis';
import * as cheerio from 'cheerio';
import { getSite } from './SiteRegistry';
import { UrlUtils } from '../utils/UrlUtils';

export interface RefreshUrlsConfig {
    site: string;
    displayName: string;
    cacheSetKey: string;
    legacyQueue?: boolean;
}

export class BaseRefreshUrls {
    constructor(protected config: RefreshUrlsConfig) {}

    public async run(): Promise<void> {
        const { site, displayName, cacheSetKey, legacyQueue } = this.config;
        const bronzeHtmlCollection: `bronze/${string}` = `bronze/${site}.html`;
        const urlsCollection: `bronze/${string}` = `bronze/${site}.urls`;

        console.log(`🔄 [${displayName} Refresh Urls] Starting precision recovery of uncollected targets...`);
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        const redis = new Redis(redisUrl);

        try {
            const bronzeHtml = await mongo.getCollection(bronzeHtmlCollection);
            const urlsColl = await mongo.getCollection(urlsCollection);

            const completedIds = await bronzeHtml.distinct('id');
            console.log(`📥 Loaded ${completedIds.length} already completed ${displayName} IDs.`);

            const priority = process.env.PRIORITY || 'medium';
            const perSiteQueueKey = `scrape_queue:${site}:${priority}`;
            const existingQueueUrls = new Set<string>();

            if (legacyQueue) {
                const legacyQueueLen = await redis.llen('scrape_queue');
                if (legacyQueueLen > 0) {
                    const legacyPayloads = await redis.lrange('scrape_queue', 0, -1);
                    for (const p of legacyPayloads) {
                        try {
                            const payload = JSON.parse(p);
                            if (payload.site === site && payload.url) {
                                existingQueueUrls.add(payload.url);
                            }
                        } catch {}
                    }
                }
                console.log(`📥 Loaded ${existingQueueUrls.size} ${displayName} URLs currently in Redis scrape_queue.`);
            } else {
                const queueLen = await redis.llen(perSiteQueueKey);
                if (queueLen > 0) {
                    const payloads = await redis.lrange(perSiteQueueKey, 0, -1);
                    for (const p of payloads) {
                        try {
                            const payload = JSON.parse(p);
                            if (payload.url) {
                                existingQueueUrls.add(payload.url);
                            }
                        } catch {}
                    }
                }
                console.log(`📥 Loaded ${existingQueueUrls.size} ${displayName} URLs currently in Redis queue.`);
            }

            const overwrite = process.env.OVERWRITE === 'true';
            const errorReset = process.env.ERROR_RESET === 'true';

            let query: Record<string, any>;
            if (errorReset) {
                query = { status: 'failed' };
                console.log(`🔧 ERROR_RESET mode: fetching only failed URLs...`);
            } else {
                query = { ...(overwrite ? {} : { id: { $nin: completedIds } }), status: { $ne: 'failed' } };
            }
            const targets = await urlsColl.find(query, { projection: { id: 1, url: 1 } }).toArray();
            console.log(`🔍 Found ${targets.length} target items in database${overwrite ? ' (OVERWRITE mode)' : ''}${errorReset ? ' (ERROR_RESET mode)' : ''}.`);

            const filteredJobs = targets.filter(j => j.url && (overwrite || !existingQueueUrls.has(j.url)));
            console.log(`💡 Filtered out ${targets.length - filteredJobs.length} items already waiting in Redis queue.`);

            if (filteredJobs.length > 0) {
                const idsToUpdate = filteredJobs.map(j => j.id);

                if (overwrite) {
                    for (const id of idsToUpdate) {
                        await redis.srem(cacheSetKey, id);
                    }
                }

                console.log(`📥 Pushing ${filteredJobs.length} URLs to Redis queue...`);
                const payloads = filteredJobs.map(j => JSON.stringify({
                    site,
                    url: j.url,
                    attempt: 1,
                    priority,
                    recursive: process.env.RECURSIVE_SCRAPE === 'true',
                }));

                const chunkSize = 1000;
                for (let i = 0; i < payloads.length; i += chunkSize) {
                    const chunk = payloads.slice(i, i + chunkSize);
                    await redis.rpush(perSiteQueueKey, ...chunk);
                }

                const result = await urlsColl.updateMany(
                    { id: { $in: idsToUpdate } },
                    { $set: { pushedToRedis: true, status: 'new', updatedAt: new Date() } }
                );

                console.log(`✨ Recovery complete! Redis Queue Pushed: ${filteredJobs.length}, MongoDB Modified Count: ${result.modifiedCount}`);
            } else {
                console.log('💡 No new target items to recover.');
            }
            const desc = getSite(site);
            if (desc?.domain && desc?.scraper?.extractId) {
                await this.scanHtmlForUrls(mongo, redis, site, desc.domain, desc.scraper, completedIds);
            }
        } catch (err: any) {
            console.error('❌ Error during queue recovery:', err);
        } finally {
            await redis.quit();
            await mongo.close();
            process.exit(0);
        }
    }

    private async scanHtmlForUrls(
        mongo: MongoDatabase,
        redis: Redis,
        site: string,
        domain: string,
        scraper: { extractId: (url: string) => string | null; urlsCollectionName?: string },
        completedIds: string[]
    ): Promise<void> {
        const { config } = this;
        const bronzeHtmlCollection: `bronze/${string}` = `bronze/${site}.html`;
        const urlsCollection: `bronze/${string}` = `bronze/${site}.urls`;
        if (!scraper.urlsCollectionName) return;

        const htmlColl = await mongo.getCollection(bronzeHtmlCollection);
        const urlsColl = await mongo.getCollection(urlsCollection);
        const priority = process.env.PRIORITY || 'medium';
        const perSiteQueueKey = `scrape_queue:${site}:${priority}`;

        // Load existing urls set
        const existingIds = new Set<string>();
        const existingDocs = await urlsColl.find({}, { projection: { id: 1 }, maxTimeMS: 30000 }).toArray();
        for (const doc of existingDocs) {
            if (doc?.id) existingIds.add(String(doc.id));
        }

        // Load existing queue urls
        const queuedIds = new Set<string>();
        const queueLen = await redis.llen(perSiteQueueKey);
        if (queueLen > 0) {
            const payloads = await redis.lrange(perSiteQueueKey, 0, -1);
            for (const p of payloads) {
                try {
                    const parsed = JSON.parse(p);
                    if (parsed.url) {
                        const id = scraper.extractId(parsed.url);
                        if (id) queuedIds.add(id);
                    }
                } catch {}
            }
        }

        const htmlDocs = await htmlColl.find({}, { projection: { rawHtml: 1 }, maxTimeMS: 30000 }).toArray();
        const newUrls: { id: string; url: string }[] = [];
        let totalLinks = 0;

        for (const doc of htmlDocs) {
            if (!doc?.rawHtml) continue;
            const $ = cheerio.load(doc.rawHtml);

            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) return;
                totalLinks++;

                try {
                    let fullUrl = new URL(href, 'https://' + domain).toString();
                    const parsed = new URL(fullUrl);
                    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;
                    if (parsed.hostname !== domain && !parsed.hostname.endsWith(`.${domain}`)) {
                        const extracted = UrlUtils.extractDomainUrl(fullUrl, domain);
                        if (!extracted) return;
                        fullUrl = extracted;
                    }
                    fullUrl = UrlUtils.stripTrackingParams(fullUrl).split('#')[0];
                    if (UrlUtils.isBinaryUrl(fullUrl)) return;
                    const id = scraper.extractId(fullUrl);
                    if (!id) return;
                    if (existingIds.has(id) || queuedIds.has(id)) return;
                    if (completedIds.includes(id)) return;

                    newUrls.push({ id, url: fullUrl });
                    existingIds.add(id);
                } catch {}
            });
        }

        if (newUrls.length === 0) {
            console.log(`💡 No new URLs found in existing HTML docs.`);
            return;
        }

        console.log(`🔍 Scanned ${totalLinks} links, found ${newUrls.length} new URLs.`);

        // Add to urls collection
        const chunkSize = 1000;
        for (let i = 0; i < newUrls.length; i += chunkSize) {
            const chunk = newUrls.slice(i, i + chunkSize);
            const bulkOps = chunk.map(u => ({
                updateOne: {
                    filter: { id: u.id },
                    update: { $set: { id: u.id, url: u.url, status: 'new', pushedToRedis: false, updatedAt: new Date() } },
                    upsert: true,
                }
            }));
            await urlsColl.bulkWrite(bulkOps);
        }

        // Queue them
        const queuePayloads = newUrls.map(u => JSON.stringify({
            site,
            url: u.url,
            attempt: 1,
            priority,
            recursive: process.env.RECURSIVE_SCRAPE === 'true',
        }));
        for (let i = 0; i < queuePayloads.length; i += chunkSize) {
            const chunk = queuePayloads.slice(i, i + chunkSize);
            await redis.rpush(perSiteQueueKey, ...chunk);
        }

        await urlsColl.updateMany(
            { id: { $in: newUrls.map(u => u.id) } },
            { $set: { pushedToRedis: true } }
        );

        console.log(`✨ Discovered and queued ${newUrls.length} new URLs from HTML content.`);
    }
}
