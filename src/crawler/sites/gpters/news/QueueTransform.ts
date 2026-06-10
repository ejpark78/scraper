import { BaseQueueTransform } from '../../../../crawler/core/BaseQueueTransform';

const queueTransform = new BaseQueueTransform({
    site: 'gpters',
    bronzeCollection: 'bronze/gpters.html',
    idExtract: (doc: any) => doc.id || doc.postId,
    includeUrlInPayload: true,
});

queueTransform.run().catch(console.error);
