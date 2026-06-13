import { MongoDatabase } from '../database/mongo';
import { MeiliSearchDatabase } from '../database/meili';

async function run() {
    const mongo = MongoDatabase.getInstance();
    const meili = MeiliSearchDatabase.getInstance();
    
    try {
        await mongo.connect();
        
        // 1. Search in MeiliSearch
        if (await meili.isHealthy()) {
            const results = await meili.search('contents', 'Trend A Word', {
                limit: 10
            });
            console.log(`MeiliSearch hits for 'Trend A Word': ${results.hits.length}`);
            results.hits.forEach((h: any) => {
                console.log(`- Index ID: ${h.id}, Title: ${h.title}, Site: ${h.site}, URL: ${h.url}`);
            });
        }
        
        // 2. Search in Mongo silver/maily_josh.contents
        const contentsColl = await mongo.getCollection('silver/maily_josh.contents');
        const countJoshContents = await contentsColl.countDocuments({ title: /Trend A Word/i });
        console.log(`MongoDB silver/maily_josh.contents matches: ${countJoshContents}`);
        
        // 3. Search in all collections with name matching /\.contents$/
        const client = (mongo as any).client;
        const silverDb = client.db('silver');
        const collections = await silverDb.listCollections().toArray();
        for (const col of collections) {
            const coll = silverDb.collection(col.name);
            const count = await coll.countDocuments({ title: /Trend A Word/i });
            if (count > 0) {
                console.log(`MongoDB silver/${col.name} matches: ${count}`);
                const sample = await coll.findOne({ title: /Trend A Word/i });
                console.log(`  Sample URL: ${sample.url}`);
            }
        }
        
    } catch (err: any) {
        console.error('Error:', err);
    } finally {
        await mongo.close();
    }
}
run();
