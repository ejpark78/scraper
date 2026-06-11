/**
 * @module UppityList
 * @description Crawls lists of articles from Uppity categories and extracts detail URLs.
 * @constraints
 *   - Excludes category, tag, author, page, login, logout, and download.cm URLs.
 *   - Uses BaseListService for database storage (bronze/uppity.urls) and Redis queueing.
 * @dependencies cheerio, BaseListService
 * @lastUpdated 2026-06-11
 */

import * as cheerio from 'cheerio';
import { BaseListService } from '../../core/BaseListService';
import { descriptor, SECTIONS } from './site.config';


class UppityList extends BaseListService {
    constructor() {
        super({
            site: descriptor.key,
            displayName: descriptor.name,
            cacheSetKey: descriptor.transformer?.completedSetKey || `completed_${descriptor.key}`,
            bronzeHtmlCollection: descriptor.scraper?.collectionName || `bronze/${descriptor.key}.html` as any,
            urlsCollection: descriptor.scraper?.urlsCollectionName || `bronze/${descriptor.key}.urls` as any,
        });
    }

    public async run(pageArg?: number): Promise<number> {
        const pageStr = process.env.PAGE || '1';
        const sleepSec = parseInt(process.env.LIST_SLACK || '2', 10);

        let sectionsToProcess = SECTIONS;
        const sectionFilter = process.env.SECTION;
        if (sectionFilter) {
            sectionsToProcess = SECTIONS.filter(s => s.slug === sectionFilter);
        }

        await this.seedCache();

        let queuedCount = 0;

        for (const section of sectionsToProcess) {
            const pageRange = pageStr.includes('-')
                ? pageStr.split('-').map(Number)
                : [1, parseInt(pageStr, 10)];

            const startPage = pageArg || pageRange[0];
            const endPage = pageRange[1] || startPage;

            for (let p = startPage; p <= endPage; p++) {
                let fetchUrl = '';
                if (descriptor.scraper?.generateUrls) {
                    const urls = descriptor.scraper.generateUrls({ page: p, section: section.slug });
                    if (urls.length > 0) {
                        fetchUrl = urls[0];
                    }
                }

                console.log(`🌐 [Uppity List] [${section.name}] Fetching page ${p}: ${fetchUrl}`);

                const res = await fetch(fetchUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                    }
                });

                if (!res.ok) {
                    console.log(`⚠️ Page ${p} for ${section.name} not found (${res.status}). Stopping this section.`);
                    break;
                }

                const html = await res.text();
                const $ = cheerio.load(html);

                const links = this.extractArticleLinks($);

                if (links.length === 0) {
                    console.log(`🏁 [Uppity List] No articles found on page ${p} of ${section.name}.`);
                    break;
                }

                console.log(`🔍 [Uppity List] Found ${links.length} articles on page ${p} of ${section.name}.`);

                for (const { url: articleUrl, title } of links) {
                    const crypto = require('crypto');
                    const id = crypto.createHash('md5').update(articleUrl).digest('hex');
                    if (await this.processItem(id, articleUrl, title)) {
                        queuedCount++;
                    }
                }

                if (p < endPage) {
                    console.log(`💤 Waiting ${sleepSec}s before next page...`);
                    await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
                }
            }
        }

        console.log(`🎉 [Uppity List] Successfully queued ${queuedCount} items.`);
        return queuedCount;
    }

    private extractArticleLinks($: cheerio.CheerioAPI): Array<{ url: string; title: string }> {
        const results: Array<{ url: string; title: string }> = [];
        const seen = new Set<string>();

        const selectors = [
            '.uc_post_title a',
            '.ue_p_title a',
            '.elementor-heading-title a',
            'h2 a',
            'h3 a',
            'h4 a',
            '.post-title a',
            '.entry-title a',
        ];

        for (const sel of selectors) {
            $(sel).each((_, el) => {
                const href = $(el).attr('href');
                const title = $(el).text().trim();
                if (href && title && href.startsWith(`https://${descriptor.domain}/`) && !seen.has(href)) {
                    const skipPatterns = ['/category/', '/tag/', '/author/', '/page/', '#', '?', 'login', 'logout', 'download.cm'];
                    if (!skipPatterns.some(p => href.includes(p))) {
                        seen.add(href);
                        results.push({ url: href, title });
                    }
                }
            });
            if (results.length > 0) break;
        }

        return results;
    }
}

if (require.main === module) {
    (async () => {
        const list = new UppityList();
        try {
            await list.init();
            await list.run();
        } catch (e: any) {
            console.error(`❌ List failed: ${e.message}`);
        } finally {
            await list.close();
        }
    })();
}
