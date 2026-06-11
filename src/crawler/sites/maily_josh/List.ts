/**
 * @module List
 * @description Core functionality or script runner for List.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies cheerio, BaseListService, crypto
 * @lastUpdated 2026-06-11
 */

import * as cheerio from 'cheerio';
import { BaseListService } from '../../core/BaseListService';

const BASE_URL = 'https://maily.so/josh';
const PAGE_PARAMS = 'controller=spaces%2Fpages&action=home&space_url=josh';

class MailyJoshList extends BaseListService {
  constructor() {
    super({
      site: 'maily_josh',
      displayName: '조쉬의 뉴스레터',
      cacheSetKey: 'completed_maily_josh',
      bronzeHtmlCollection: 'bronze/maily_josh.html',
      urlsCollection: 'bronze/maily_josh.urls',
    });
  }

  public async run(pageArg?: number): Promise<number> {
    const sleepSec = parseInt(process.env.LIST_SLACK || '2', 10);
    const pageStr = process.env.PAGE || '1';
    const pageRange = pageStr.includes('-')
      ? pageStr.split('-').map(Number)
      : [1, parseInt(pageStr, 10)];
    const startPage = pageArg || pageRange[0];
    const endPage = pageRange[1] || startPage;

    await this.seedCache();

    let queuedCount = 0;
    const seenUrls = new Set<string>();

    for (let page = startPage; page <= endPage; page++) {
      const fetchUrl = `${BASE_URL}?page=${page}&${PAGE_PARAMS}`;
      console.log(`🌐 [MailyJosh List] Fetching page ${page}: ${fetchUrl}`);

      const res = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!res.ok) {
        console.log(`⚠️ Page ${page} failed (${res.status}). Stopping.`);
        break;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      const articleLinks = this.extractArticleLinks($, seenUrls);

      if (articleLinks.length === 0) {
        console.log(`🏁 [MailyJosh List] No articles found on page ${page}. Done.`);
        break;
      }

      console.log(`🔍 [MailyJosh List] Found ${articleLinks.length} new articles on page ${page}.`);

      for (const { url, title } of articleLinks) {
        const crypto = require('crypto');
        const id = crypto.createHash('md5').update(url).digest('hex');
        if (await this.processItem(id, url, title)) {
          queuedCount++;
        }
      }

      if (page < endPage) {
        console.log(`💤 Waiting ${sleepSec}s before next page...`);
        await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
      }
    }

    console.log(`🎉 [MailyJosh List] Successfully queued ${queuedCount} items.`);
    return queuedCount;
  }

  private extractArticleLinks(
    $: cheerio.CheerioAPI,
    seenUrls: Set<string>,
  ): Array<{ url: string; title: string }> {
    const results: Array<{ url: string; title: string }> = [];

    $('a.post-card-list-item[href*="/josh/posts/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || seenUrls.has(href)) return;
      seenUrls.add(href);

      const titleEl = $(el).find('.font-bold').first();
      const title = titleEl.text().trim();
      if (title) {
        results.push({ url: href, title });
      }
    });

    return results;
  }
}

if (require.main === module) {
  (async () => {
    const list = new MailyJoshList();
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
