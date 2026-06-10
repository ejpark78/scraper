import { BaseRefreshUrls } from '../../core/BaseRefreshUrls';

class YozmRefreshUrls extends BaseRefreshUrls {
  constructor() {
    super({
      site: 'yozm',
      displayName: '요즘IT',
      cacheSetKey: 'completed_yozm',
      legacyQueue: false,
    });
  }
}

if (require.main === module) {
  const refreshUrls = new YozmRefreshUrls();
  refreshUrls.run().catch(console.error);
}
