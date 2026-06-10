import { BaseQueueTransform } from '../../core/BaseQueueTransform';

const queueTransform = new BaseQueueTransform({
    site: 'uppity',
    bronzeCollection: 'bronze/uppity.html',
});

queueTransform.run().catch(console.error);
