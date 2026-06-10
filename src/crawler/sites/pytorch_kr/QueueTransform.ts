import { BaseQueueTransform } from '../../core/BaseQueueTransform';

const queueTransform = new BaseQueueTransform({
    site: 'pytorch_kr',
    bronzeCollection: 'bronze/pytorch_kr.html',
    idExtract: (doc: any) => doc.topicId || doc.id || doc._id?.toString(),
});

queueTransform.run().catch(console.error);
