import { BaseRefreshUrls } from '../../core/BaseRefreshUrls';

class GeekNewsRefreshUrls extends BaseRefreshUrls {
    constructor() {
        super({
            site: 'geeknews',
            displayName: 'GeekNews',
            cacheSetKey: 'completed_news',
            legacyQueue: true
        });
    }
}

if (require.main === module) {
    const refreshUrls = new GeekNewsRefreshUrls();
    refreshUrls.run().catch(console.error);
}
