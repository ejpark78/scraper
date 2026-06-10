import { BaseRefreshUrls } from '../../core/BaseRefreshUrls';

class AiCasebookRefreshUrls extends BaseRefreshUrls {
    constructor() {
        super({
            site: 'aicasebook',
            displayName: 'AiCasebook',
            cacheSetKey: 'completed_aicasebook',
            legacyQueue: true
        });
    }
}

if (require.main === module) {
    const refreshUrls = new AiCasebookRefreshUrls();
    refreshUrls.run().catch(console.error);
}
