import { BaseRefreshUrls } from '../../core/BaseRefreshUrls';

class DailyDoseDSRefreshUrls extends BaseRefreshUrls {
    constructor() {
        super({
            site: 'dailydose_ds',
            displayName: 'Daily Dose DS',
            cacheSetKey: 'completed_ddds',
            legacyQueue: false
        });
    }
}

if (require.main === module) {
    const refreshUrls = new DailyDoseDSRefreshUrls();
    refreshUrls.run().catch(console.error);
}
