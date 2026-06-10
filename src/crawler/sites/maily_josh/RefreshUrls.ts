import { BaseRefreshUrls } from '../../core/BaseRefreshUrls';

class MailyJoshRefreshUrls extends BaseRefreshUrls {
  constructor() {
    super({
      site: 'maily_josh',
      displayName: '조쉬의 뉴스레터',
      cacheSetKey: 'completed_maily_josh',
      legacyQueue: false,
    });
  }
}

if (require.main === module) {
  const refreshUrls = new MailyJoshRefreshUrls();
  refreshUrls.run().catch(console.error);
}
