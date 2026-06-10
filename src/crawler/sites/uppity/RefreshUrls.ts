import { BaseRefreshUrls } from '../../core/BaseRefreshUrls';

class UppityRefreshUrls extends BaseRefreshUrls {
    constructor() {
        super({
            site: 'uppity',
            displayName: 'Uppity',
            cacheSetKey: 'completed_uppity',
            legacyQueue: false,
        });
    }
}

if (require.main === module) {
    const refreshUrls = new UppityRefreshUrls();
    refreshUrls.run().catch(console.error);
}
