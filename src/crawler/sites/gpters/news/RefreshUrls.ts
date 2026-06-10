import { BaseRefreshUrls } from '../../../../crawler/core/BaseRefreshUrls';

class GptersRefreshUrls extends BaseRefreshUrls {
    constructor() {
        super({
            site: 'gpters',
            displayName: 'GPTERS',
            cacheSetKey: 'completed_news',
            legacyQueue: true
        });
    }
}

if (require.main === module) {
    const refreshUrls = new GptersRefreshUrls();
    refreshUrls.run().catch(console.error);
}
