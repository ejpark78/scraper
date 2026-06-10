import { BaseRefreshUrls } from '../../core/BaseRefreshUrls';

class PyTorchKRRefreshUrls extends BaseRefreshUrls {
    constructor() {
        super({
            site: 'pytorch_kr',
            displayName: 'PyTorch KR',
            cacheSetKey: 'completed_news',
            legacyQueue: true
        });
    }
}

if (require.main === module) {
    const refreshUrls = new PyTorchKRRefreshUrls();
    refreshUrls.run().catch(console.error);
}
