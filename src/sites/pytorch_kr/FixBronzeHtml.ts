import { MongoDatabase } from '../../database/mongo';
import { ObjectId } from 'mongodb';

const DISCOURSE_BASE = 'https://discuss.pytorch.kr';
const CONCURRENCY = 5;
const FETCH_DELAY_MS = 300;

function isSpaShell(rawHtml: string): boolean {
    return rawHtml.includes('id="main-outlet"') && !rawHtml.includes('itemprop="text"');
}

function buildJsonUrl(doc: any): string {
    if (doc.url) {
        return doc.url.includes('.json') ? doc.url : `${doc.url}.json`;
    }
    const topicId = doc.topicId || doc.id;
    if (!topicId) return '';
    return `${DISCOURSE_BASE}/t/-/${topicId}.json`;
}

async function fetchAndFix(context: {
    _id: ObjectId;
    url?: string;
    topicId?: string;
    id?: string;
    bronzColl: any;
}): Promise<boolean> {
    const { _id, url, topicId, id, bronzColl } = context;
    const jsonUrl = buildJsonUrl({ url, topicId, id });
    if (!jsonUrl) return false;

    const res = await fetch(jsonUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    });
    if (!res.ok) return false;

    const data = await res.json() as any;
    const cooked: string = data.post_stream?.posts?.[0]?.cooked;
    if (!cooked) return false;

    const title = (data.title || 'Unknown Title') as string;
    const createdAt = (data.created_at || '') as string;
    const html = `<!DOCTYPE html>
<html>
<head><title>${title.replace(/</g, '&lt;')} - PyTorchKR</title>
<link rel="canonical" href="${DISCOURSE_BASE}/t/-/${topicId || id}">
<meta property="article:published_time" content="${createdAt}">
</head>
<body>
<div class="post" itemprop="text">${cooked}</div>
</body>
</html>`;

    await bronzColl.updateOne(
        { _id },
        { $set: { rawHtml: html, fixedAt: new Date() } }
    );
    return true;
}

function delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

function extractContext(doc: any) {
    return {
        _id: doc._id,
        url: doc.url as string | undefined,
        topicId: doc.topicId as string | undefined,
        id: doc.id as string | undefined,
    };
}

async function main() {
    console.log('🔧 [Fix Bronze HTML] Fixing PyTorch KR bronze SPA HTML via Discourse JSON API...');
    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    try {
        const bronzePytorch = await mongo.getCollection('bronze/pytorch_kr.html');
        const total = await bronzePytorch.countDocuments();
        console.log(`📥 ${total} documents in bronze/pytorch_kr.html.`);

        const cursor = bronzePytorch.find({}).batchSize(100);
        let fixed = 0;
        let failed = 0;
        let scanned = 0;
        const batch: any[] = [];

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            if (!doc || !doc.rawHtml) continue;
            scanned++;
            if (!isSpaShell(doc.rawHtml)) continue;

            batch.push(extractContext(doc));

            if (batch.length >= CONCURRENCY) {
                const contexts = batch.splice(0, CONCURRENCY);
                const ctxWithColl = contexts.map(c => ({ ...c, bronzColl: bronzePytorch }));
                const results = await Promise.all(ctxWithColl.map(c =>
                    fetchAndFix(c).catch(() => false)
                ));
                fixed += results.filter(r => r).length;
                failed += results.filter(r => !r).length;
                console.log(`📊 Scanned: ${scanned}, Fixed: ${fixed}, Failed: ${failed}`);
                await delay(FETCH_DELAY_MS);
            }
        }

        if (batch.length > 0) {
            const ctxWithColl = batch.map(c => ({ ...c, bronzColl: bronzePytorch }));
            const results = await Promise.all(ctxWithColl.map(c =>
                fetchAndFix(c).catch(() => false)
            ));
            fixed += results.filter(r => r).length;
            failed += results.filter(r => !r).length;
        }

        console.log(`\n✅ Done. Scanned: ${scanned}, Fixed: ${fixed}, Failed: ${failed}`);
    } catch (e: any) {
        console.error('❌ Fatal:', e);
    } finally {
        await mongo.close();
        process.exit(0);
    }
}

main();
