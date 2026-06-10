import { BaseQueueTransform } from '../../core/BaseQueueTransform';

const queueTransform = new BaseQueueTransform({
    site: 'dailydose_ds',
    bronzeCollection: 'bronze/dailydose_ds.html',
});

queueTransform.run().catch(console.error);
