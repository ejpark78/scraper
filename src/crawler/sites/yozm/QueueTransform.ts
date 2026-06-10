import { BaseQueueTransform } from '../../core/BaseQueueTransform';

const queueTransform = new BaseQueueTransform({
  site: 'yozm',
  bronzeCollection: 'bronze/yozm.html',
});

queueTransform.run().catch(console.error);
