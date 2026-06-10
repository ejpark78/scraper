import { BaseListService } from '../../core/BaseListService';

const SITEMAP_URL = 'https://yozm.wishket.com/magazine/sitemap-news.xml';

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
