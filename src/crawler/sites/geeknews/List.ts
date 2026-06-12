/**
 * @module List
 * @description Core functionality or script runner for List.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies cheerio, mongo, BaseListService, utils
 * @lastUpdated 2026-06-11
 */

import * as cheerio from 'cheerio';
import { BaseListService } from '../../core/BaseListService';
import { descriptor } from './site.config';

class GeekNewsList extends BaseListService {
    constructor() {
        super({
            site: descriptor.key,
            displayName: descriptor.name,
            cacheSetKey: descriptor.transformer?.completedSetKey || `completed_${descriptor.key}`,
            bronzeHtmlCollection: descriptor.scraper?.collectionName || `bronze/${descriptor.key}.html` as any,
            urlsCollection: descriptor.scraper?.urlsCollectionName || `bronze/${descriptor.key}.urls` as any,
        });
    }

    public async run(page: number = 1): Promise<number> {
        let urls = [descriptor.domain ? `https://${descriptor.domain}/` : 'https://news.hada.io/'];
        if (descriptor.scraper?.generateUrls) {
            urls = descriptor.scraper.generateUrls({ page });
        }

        const sleepSec = parseInt(process.env.LIST_SLACK || '3', 10);
        await this.seedCache();

        let queuedCount = 0;

        for (const url of urls) {
            if (sleepSec > 0) {
                console.log(`💤 [대기] GeekNews 목록 수집 전 ${sleepSec}초 대기 중...`);
                await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
            }

            console.log(`🌐 [GeekNews List] Fetching page: ${url}`);
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                    }
                });

                if (!response.ok) {
                    console.error(`❌ Failed to fetch GeekNews page ${url}. Status: ${response.status}`);
                    continue;
                }

                const html = await response.text();
                const $ = cheerio.load(html);
                const topicRows = $('.topic_row');
                console.log(`🔍 [GeekNews List] Found ${topicRows.length} topics on page: ${url}`);

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

                    let detailUrl = `https://${descriptor.domain}/${topicUrl.replace(/^\//, '')}`;

                    let id = '';
                    const match = topicUrl.match(/id=(\d+)/);
                    if (match) {
                        id = match[1];
                    }

                    if (!id) continue;

                    if (await this.processItem(id, detailUrl, title)) {
                        queuedCount++;
                    }
                }
            } catch (err: any) {
                console.error(`❌ Error fetching/processing ${url}: ${err.message}`);
            }
        }

        console.log(`🎉 [GeekNews List] Successfully queued ${queuedCount} items.`);
        return queuedCount;
    }
}

if (require.main === module) {
    (async () => {
        const list = new GeekNewsList();
        try {
            await list.init();
            const arg = process.argv[2] || '1';

            if (arg.includes('-')) {
                const [startStr, endStr] = arg.split('-');
                const start = parseInt(startStr, 10) || 1;
                const end = parseInt(endStr, 10) || start;
                console.log(`🚀 [GeekNews List] Running page range: ${start} to ${end}`);

                for (let p = start; p <= end; p++) {
                    console.log(`\n📄 [GeekNews List] Processing page ${p}/${end}...`);
                    await list.run(p);
                }
            } else {
                const page = parseInt(arg, 10) || 1;
                await list.run(page);
            }
        } catch (e: any) {
            console.error(`❌ List failed: ${e.message}`);
        } finally {
            await list.close();
        }
    })();
}
