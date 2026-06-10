import { chromium } from 'playwright';
import { MongoDatabase } from '../../../database/mongo';
import { BaseListService } from '../../core/BaseListService';

class AiCasebookList extends BaseListService {
    constructor() {
        super({
            site: 'aicasebook',
            displayName: 'AiCasebook',
            cacheSetKey: 'completed_aicasebook',
            bronzeHtmlCollection: 'bronze/aicasebook.html',
            urlsCollection: 'bronze/aicasebook.urls',
        });
    }

    public async run(): Promise<number> {
        const sleepSec = parseInt(process.env.SLACK_TIME || '3', 10);
        if (sleepSec > 0) {
            console.log(`💤 [AiCasebook List] 스크래핑 전 ${sleepSec}초 대기 중...`);
            await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
        }

        console.log(`🌐 [AiCasebook List] Launching browser for main page...`);
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();

        try {
            await page.goto('https://aicasebook.dev/', { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForSelector('a[href^="/setup/"]', { timeout: 10000 });

            const items = await page.$$eval('a[href^="/setup/"]', (els) => {
                const seen = new Set<string>();
                return els
                    .map((el) => {
                        const anchor = el as HTMLAnchorElement;
                        const href = anchor.href;
                        const match = href.match(/\/setup\/(\d+)/);
                        if (!match) return null;
                        const id = match[1];
                        if (seen.has(id)) return null;
                        seen.add(id);
                        return { id, url: href };
                    })
                    .filter(Boolean) as { id: string; url: string }[];
            });

            console.log(`🔍 [AiCasebook List] Found ${items.length} unique articles on main page.`);

            await this.seedCache();

            let queuedCount = 0;

            for (const item of items) {
                const { id, url } = item;

                if (await this.processItem(id, url, '')) {
                    queuedCount++;
                }
            }

            console.log(`🎉 [AiCasebook List] Successfully queued ${queuedCount} items.`);
            return queuedCount;
        } finally {
            await browser.close();
        }
    }
}

if (require.main === module) {
    (async () => {
        const list = new AiCasebookList();
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
