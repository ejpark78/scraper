/**
 * @module Backfill
 * @description Core functionality or script runner for Backfill.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies cheerio, ioredis, mongo, utils
 * @lastUpdated 2026-06-11
 */

import * as cheerio from 'cheerio';
import Redis from 'ioredis';
import { MongoDatabase } from '../../../database/mongo';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const CACHE_SET_KEY = 'completed_news';

export class GeekNewsBackfill {
    private redis!: Redis;

    public async init(): Promise<void> {
        this.redis = new Redis(REDIS_URL);
        console.log(`📡 [GeekNews Backfill] Connected to Redis for queueing.`);
    }

    public async close(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
        }
        try {
            await MongoDatabase.getInstance().close();
        } catch (err: any) {
            console.warn(`⚠️ Error closing MongoDB connection: ${err.message}`);
        }
    }

    public async run(day: string): Promise<number> {
        let page = 1;
        let totalQueuedCount = 0;
        
        while (true) {
            const url = `https://news.hada.io/past?day=${day}&page=${page}`;
            
            const sleepSec = parseInt(process.env.SLACK_TIME || '3', 10);
            if (sleepSec > 0) {
                console.log(`\n💤 [대기] GeekNews 백필 (${day}, page ${page}) 수집 전 ${sleepSec}초 대기 중...`);
                await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
            }

            console.log(`🌐 [GeekNews Backfill] Fetching page: ${url}`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                console.error(`❌ Failed to fetch GeekNews page. Status: ${response.status}`);
                break;
            }

            const html = await response.text();
            
            // 🧹 HTML Minify 및 MongoDB bronze/geeknews.lists 저장 추가
            try {
                const { HtmlMinifier } = require('../../utils');
                const minifiedHtml = await HtmlMinifier.minify(html, { preserveJsonLd: true });
                const dbInstance = MongoDatabase.getInstance();
                const geeknewsListsColl = await dbInstance.getCollection('bronze/geeknews.lists');
                
                await geeknewsListsColl.updateOne(
                    { day, page },
                    {
                        $set: {
                            day,
                            page,
                            rawHtml: minifiedHtml,
                            url,
                            scrapedAt: new Date()
                        }
                    },
                    { upsert: true }
                );
                console.log(`💾 [MongoDB Write] Saved minified HTML of ${day} (page ${page}) list to bronze/geeknews.lists`);
            } catch (minifyErr: any) {
                console.error(`⚠️ Failed to minify or save list HTML to MongoDB: ${minifyErr.message}`);
            }

            const $ = cheerio.load(html);
            const topicRows = $('.topic_row');
            console.log(`🔍 [GeekNews Backfill] Found ${topicRows.length} topics on page.`);

            if (topicRows.length === 0) {
                break;
            }

            const dbInstance = MongoDatabase.getInstance();
            const geeknewsUrlsColl = await dbInstance.getCollection('bronze/geeknews.urls');

            // Synchronize Completed cache with MongoDB first if Redis cache is empty
            const completedCount = await this.redis.scard(CACHE_SET_KEY);
            if (completedCount === 0) {
                try {
                    console.log(`🔍 [GeekNews Backfill] Redis cache is empty. Seeding from MongoDB bronze.geeknews...`);
                    const bronzeGeeknews = await dbInstance.getCollection('bronze/geeknews.html');
                    const cursor = bronzeGeeknews.find({}, { projection: { id: 1, _id: 0 } });
                    let seedCount = 0;
                    for await (const doc of cursor) {
                        if (doc.id) {
                            await this.redis.sadd(CACHE_SET_KEY, doc.id);
                            seedCount++;
                        }
                    }
                    if (seedCount > 0) {
                        console.log(`📡 [GeekNews Backfill] Seeded ${seedCount} completed IDs into Redis cache.`);
                    }
                } catch (err: any) {
                    console.warn(`⚠️ MongoDB seed skipped or failed: ${err.message}`);
                }
            }

            let queuedCount = 0;

            for (let i = 0; i < topicRows.length; i++) {
                const row = $(topicRows[i]);
                const titleEl = row.find('.topictitle a');
                if (titleEl.length === 0) continue;

                const title = titleEl.text().trim();
                let relativeUrl = titleEl.attr('href') || '';
                if (!relativeUrl) continue;

                let topicUrl = '';
                const commentLinkEl = row.find('a[href^="topic?id="], a[href*="topic?id="]');
                if (commentLinkEl.length > 0) {
                    topicUrl = commentLinkEl.first().attr('href') || '';
                } else if (relativeUrl.includes('topic?id=')) {
                    topicUrl = relativeUrl;
                }

                if (!topicUrl) continue;

                let detailUrl = `https://news.hada.io/${topicUrl.replace(/^\//, '')}`;

                let id = '';
                const match = topicUrl.match(/id=(\d+)/);
                if (match) {
                    id = match[1];
                }

                if (!id) continue;

                const isCompleted = await this.redis.sismember(CACHE_SET_KEY, id);

                await geeknewsUrlsColl.updateOne(
                    { id },
                    {
                        $set: {
                            id,
                            url: detailUrl,
                            title,
                            status: isCompleted ? 'completed' : 'new',
                            updatedAt: new Date()
                        },
                        $setOnInsert: {
                            pushedToRedis: isCompleted ? true : false
                        }
                    },
                    { upsert: true }
                );

                if (isCompleted) {
                    console.log(`⏭️ [GeekNews Backfill] Skipping already completed item: [ID: ${id}] ${title}`);
                    continue;
                }

                const doc = await geeknewsUrlsColl.findOne({ id });
                const alreadyPushed = doc?.pushedToRedis || false;

                if (!alreadyPushed) {
                    const scraperSlackVal = process.env.SCRAPER_SLACK ? parseInt(process.env.SCRAPER_SLACK, 10) : 0;
                    const priority = (process.env.PRIORITY || 'medium').toLowerCase().trim();
                    
                    const payload = JSON.stringify({
                        site: 'geeknews',
                        url: detailUrl,
                        attempt: 1,
                        ...(scraperSlackVal > 0 ? { scraperSlack: scraperSlackVal } : {})
                    });

                    // 🚦 Priority-based push to Redis
                    const targetQueue = `scrape_queue:geeknews:${priority}`;
                    if (priority === 'high') {
                        // High priority: Insert at the head of the queue (L-PUSH)
                        await this.redis.lpush(targetQueue, payload);
                    } else if (priority === 'low') {
                        // Low priority: Insert at the tail of the queue (R-PUSH)
                        await this.redis.rpush(targetQueue, payload);
                    } else {
                        // Medium priority (default): Insert at the tail of the queue (R-PUSH)
                        await this.redis.rpush(targetQueue, payload);
                    }

                    await geeknewsUrlsColl.updateOne(
                        { id },
                        { $set: { pushedToRedis: true } }
                    );
                    console.log(`🚀 [GeekNews Backfill] Queued (${priority.toUpperCase()} priority): [ID: ${id}] ${title} -> ${detailUrl}`);
                    queuedCount++;
                }
            }

            totalQueuedCount += queuedCount;

            // Check if next page link exists
            const nextPage = page + 1;
            const nextPageEl = $(`a[href*='day=${day}'][href*='page=${nextPage}'], a[href*='day=${day}'][href*='page%3D${nextPage}']`);
            if (nextPageEl.length > 0) {
                page = nextPage;
            } else {
                console.log(`🏁 [GeekNews Backfill] No more pages for day ${day} (finished at page ${page}).`);
                break;
            }
        }

        return totalQueuedCount;
    }
}

function getDatesInRange(startStr: string, endStr: string): string[] {
    const dates: string[] = [];
    const current = new Date(startStr);
    const end = new Date(endStr);
    
    if (current <= end) {
        // Ascending order (past to recent)
        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
    } else {
        // Descending order (recent to past)
        while (current >= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() - 1);
        }
    }
    return dates;
}

if (require.main === module) {
    (async () => {
        const backfill = new GeekNewsBackfill();
        try {
            await backfill.init();
            const arg = process.argv[2];
            if (!arg) {
                throw new Error("Missing day argument. Usage: ts-node Backfill.ts <YYYY-MM-DD> or <YYYY-MM-DD~YYYY-MM-DD>");
            }

            let days: string[] = [];
            if (arg.includes('~')) {
                const [start, end] = arg.split('~');
                days = getDatesInRange(start.trim(), end.trim());
            } else {
                days = [arg.trim()];
            }

            console.log(`🚀 [GeekNews Backfill] Days to process: ${days.join(', ')}`);

            for (const day of days) {
                console.log(`\n📅 [GeekNews Backfill] Processing day: ${day}`);
                const count = await backfill.run(day);
                console.log(`🎉 [GeekNews Backfill] Day ${day} completed. Queued ${count} items.`);
            }
        } catch (e: any) {
            console.error(`❌ Backfill failed: ${e.message}`);
        } finally {
            await backfill.close();
        }
    })();
}
