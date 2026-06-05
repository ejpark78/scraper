import { MongoDatabase } from '../../database/mongo';
import { PyTorchKRConverter } from './Converter';
import * as fs from 'fs';
import * as path from 'path';

export class PyTorchKRBackfill {
    public async run(): Promise<void> {
        console.log('🏁 [PyTorch KR Backfill] Starting comprehensive database-to-database backfill...');
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        try {
            const bronzePytorch = await mongo.getCollection('bronze.pytorch_kr');
            const silverPytorch = await mongo.getCollection('silver.pytorch_kr');

            const converter = new PyTorchKRConverter();
            const cursor = bronzePytorch.find({});
            const docs = await cursor.toArray();
            console.log(`📥 Loaded ${docs.length} raw topics from bronze.pytorch_kr.`);

            const baseDir = path.join(__dirname, '..', '..', '..', 'data', 'pytorch_kr');
            fs.mkdirSync(path.join(baseDir, 'html'), { recursive: true });
            fs.mkdirSync(path.join(baseDir, 'markdown'), { recursive: true });

            let processed = 0;
            for (const doc of docs) {
                const { id, rawHtml, url } = doc;
                if (!id || !rawHtml) continue;

                try {
                    // 1. Convert to Markdown
                    const meta = converter.convertHtmlToMarkdown(rawHtml, id, url || '');

                    // 2. Update Silver layer
                    await silverPytorch.updateOne(
                        { id },
                        {
                            $set: {
                                id,
                                title: meta.title,
                                url: meta.url,
                                publishedAt: meta.publishedAt,
                                content: meta.content,
                                markdown: meta.rawContent,
                                updatedAt: new Date()
                            }
                        },
                        { upsert: true }
                    );

                    // 3. Local Backup Files
                    const htmlPath = path.join(baseDir, 'html', `${id}.html`);
                    const mdPath = path.join(baseDir, 'markdown', `${id}.md`);
                    fs.writeFileSync(htmlPath, rawHtml, 'utf-8');
                    await converter.prettifyAndSave(meta.rawContent, mdPath);

                    processed++;
                    if (processed % 10 === 0) {
                        console.log(`🔄 Processed ${processed}/${docs.length} topics...`);
                    }
                } catch (err: any) {
                    console.error(`❌ Error backfilling PyTorch KR ID ${id}: ${err.message}`);
                }
            }
            console.log(`✨ Backfill complete! Successfully processed ${processed} topics.`);
        } catch (err: any) {
            console.error('❌ Backfill failed:', err);
        } finally {
            await mongo.close();
        }
    }
}

if (require.main === module) {
    const backfill = new PyTorchKRBackfill();
    backfill.run().catch(console.error).then(() => process.exit(0));
}
