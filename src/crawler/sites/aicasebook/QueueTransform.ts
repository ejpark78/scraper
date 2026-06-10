import { BaseQueueTransform } from '../../core/BaseQueueTransform';

const queueTransform = new BaseQueueTransform({
    site: 'aicasebook',
    bronzeCollection: 'bronze/aicasebook.html',
});

queueTransform.run().catch(console.error);
