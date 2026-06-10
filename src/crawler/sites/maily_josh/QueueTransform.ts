import { BaseQueueTransform } from '../../core/BaseQueueTransform';

const queueTransform = new BaseQueueTransform({
  site: 'maily_josh',
  bronzeCollection: 'bronze/maily_josh.html',
});

queueTransform.run().catch(console.error);
