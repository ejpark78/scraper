import { MongoDatabase } from '../../database/mongo';
import { GptersConverter } from './Converter';
import * as fs from 'fs';
import * as path from 'path';

export class GptersBackfill {
    public async run(): Promise<void> {
        console.log('🏁 [GPTERS Backfill] Starting comprehensive database-to-database backfill...');
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        try {
            const bronzeGpters = await mongo.getCollection('bronze.gpters');
            const silverGpters = await mongo.getCollection('silver.gpters');

            const converter = new GptersConverter();
            const cursor = bronzeGpters.find({});
            const docs = await cursor.toArray();
            console.log(`📥 Loaded ${docs.length} raw posts from bronze.gpters.`);

            const baseDir = path.join(__dirname, '..', '..', '..', 'data', 'gpters');
            fs.mkdirSync(path.join(baseDir, 'json'), { recursive: true });
            fs.mkdirSync(path.join(baseDir, 'markdown'), { recursive: true });

            let processed = 0;
            for (const doc of docs) {
                const { id, rawJson, url } = doc;
                if (!id || !rawJson) continue;

                try {
                    // 1. Convert to Markdown
                    const rawJsonStr = JSON.stringify(rawJson);
                    const meta = converter.convertHtmlToMarkdown(rawJsonStr, id, url || '');

                    // 2. Update Silver layer
                    await silverGpters.updateOne(
                        { id },
                        {
                            $set: {
                                id,
                                title: meta.title,
                                url: meta.url,
                                author: meta.author,
                                shortContent: meta.shortContent,
                                publishedAt: meta.publishedAt,
                                reactionsCount: meta.reactionsCount,
                                repliesCount: meta.repliesCount,
                                markdown: meta.rawContent,
                                updatedAt: new Date()
                            }
                        },
                        { upsert: true }
                    );

                    // 3. Local Backup Files
                    const jsonPath = path.join(baseDir, 'json', `${id}.json`);
                    const mdPath = path.join(baseDir, 'markdown', `${id}.md`);
                    fs.writeFileSync(jsonPath, rawJsonStr, 'utf-8');
                    await converter.prettifyAndSave(meta.rawContent, mdPath);

                    processed++;
                    if (processed % 10 === 0) {
                        console.log(`🔄 Processed ${processed}/${docs.length} posts...`);
                    }
                } catch (err: any) {
                    console.error(`❌ Error backfilling GPTERS ID ${id}: ${err.message}`);
                }
            }
            console.log(`✨ Backfill complete! Successfully processed ${processed} posts.`);
        } catch (err: any) {
            console.error('❌ Backfill failed:', err);
        } finally {
            await mongo.close();
        }
    }
}

if (require.main === module) {
    const backfill = new GptersBackfill();
    backfill.run().catch(console.error).then(() => process.exit(0));
}
