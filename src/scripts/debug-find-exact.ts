import { MeiliSearchDatabase } from '../database/meili';

async function test() {
    const meili = MeiliSearchDatabase.getInstance();
    try {
        const search = await meili.search('contents_pytorch_kr', '', { limit: 1000 });
        const uppityInPytorch = search.hits.filter(h => h.site === 'uppity' || h.url?.includes('uppity.co.kr'));
        console.log(`Found ${uppityInPytorch.length} uppity documents inside contents_pytorch_kr:`);
        console.log(JSON.stringify(uppityInPytorch.map(h => ({ id: h.id, site: h.site, title: h.title, url: h.url })), null, 2));
    } catch (e: any) {
        console.error(e);
    }
}

test();
