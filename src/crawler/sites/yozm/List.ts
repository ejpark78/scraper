import * as cheerio from 'cheerio';
import { BaseListService } from '../../core/BaseListService';

const BASE_URL = 'https://yozm.wishket.com/magazine/@yozm_it/';

class YozmList extends BaseListService {
  constructor() {
    super({
      site: 'yozm',
      displayName: '요즘IT',
      cacheSetKey: 'completed_yozm',
      bronzeHtmlCollection: 'bronze/yozm.html',
      urlsCollection: 'bronze/yozm.urls',
    });
  }

  public async run(pageArg?: number): Promise<number> {
    const sleepSec = parseInt(process.env.SLACK_TIME || '2', 10);
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
      const fetchUrl = `${BASE_URL}?tab=content&page=${page}`;
      console.log(`🌐 [Yozm List] Fetching page ${page}: ${fetchUrl}`);

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
        console.log(`🏁 [Yozm List] No articles found on page ${page}. Done.`);
        break;
      }

      console.log(`🔍 [Yozm List] Found ${articleLinks.length} new articles on page ${page}.`);

      for (const { url, title } of articleLinks) {
        const match = url.match(/\/detail\/(\d+)\//);
        const id = match ? match[1] : '';
        if (id && (await this.processItem(id, url, title))) {
          queuedCount++;
        }
      }

      if (page < endPage) {
        console.log(`💤 Waiting ${sleepSec}s before next page...`);
        await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
      }
    }

    console.log(`🎉 [Yozm List] Successfully queued ${queuedCount} items.`);
    return queuedCount;
  }

  private extractArticleLinks(
    $: cheerio.CheerioAPI,
    seenUrls: Set<string>,
  ): Array<{ url: string; title: string }> {
    const results: Array<{ url: string; title: string }> = [];

    $('a[data-testid="contentsItem-item-link"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || seenUrls.has(href)) return;
      seenUrls.add(href);

      const titleEl = $(el).find('h3').first();
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
    const list = new YozmList();
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
