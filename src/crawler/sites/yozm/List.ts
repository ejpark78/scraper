/**
 * @module List
 * @description Core functionality or script runner for List.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies BaseListService
 * @lastUpdated 2026-06-11
 */

import { BaseListService } from '../../core/BaseListService';
import { descriptor } from './site.config';

const SITEMAP_URL = 'https://yozm.wishket.com/magazine/sitemap-news.xml';

class YozmList extends BaseListService {
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
    await this.seedCache();

    let queuedCount = 0;
    const seenUrls = new Set<string>();

    console.log(`🌐 [Yozm List] Fetching sitemap: ${SITEMAP_URL}`);

    const res = await fetch(SITEMAP_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      console.log(`⚠️ Sitemap fetch failed (${res.status}). Stopping.`);
      return 0;
    }

    const xml = await res.text();

    const urlRegex = /<loc>(https:\/\/yozm\.wishket\.com\/magazine\/detail\/(\d+)\/)<\/loc>/g;
    let match: RegExpExecArray | null;
    let totalUrls = 0;

    while ((match = urlRegex.exec(xml)) !== null) {
      totalUrls++;
      const url = match[1];
      const id = match[2];

      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      if (await this.processItem(id, url, `Article #${id}`)) {
        queuedCount++;
      }
    }

    console.log(`🔍 [Yozm List] Found ${totalUrls} total URLs in sitemap, queued ${queuedCount} new.`);
    console.log(`🎉 [Yozm List] Successfully queued ${queuedCount} items.`);
    return queuedCount;
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
