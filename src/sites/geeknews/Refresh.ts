import { MongoDatabase } from '../../database/mongo';
import { GeekNewsConverter } from './Converter';
import * as fs from 'fs';
import * as path from 'path';

export class GeekNewsRefresh {
    public async run(): Promise<void> {
        console.log('🏁 [GeekNews Backfill] Starting comprehensive database-to-database backfill...');
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        try {
            const bronzeGeeknews = await mongo.getCollection('bronze/geeknews.html');
            const silverGeeknews = await mongo.getCollection('silver/geeknews.contents');

            const converter = new GeekNewsConverter();
            const cursor = bronzeGeeknews.find({});
            const docs = await cursor.toArray();
            console.log(`📥 Loaded ${docs.length} raw articles from bronze.geeknews.`);

            let processed = 0;
            for (const doc of docs) {
                const id = doc.topicId || doc.id;
                const { rawHtml, url } = doc;
                if (!id || !rawHtml) continue;

                try {
                    // 1. Convert to Markdown
                    const meta = converter.convertHtmlToMarkdown(rawHtml, id, url || '');

                    // 2. Update Silver layer
                    await silverGeeknews.updateOne(
                        { id },
                        {
                            $set: {
                                id,
                                title: meta.title,
                                url: meta.url,
                                publishedAt: meta.publishedAt,
                                content: meta.content,
                                comments: meta.comments,
                                jsonLdRaw: meta.jsonLdRaw,
                                markdown: meta.rawContent,
                                updatedAt: new Date()
                            }
                        },
                        { upsert: true }
                    );

                    // 3. Local Backup Files
                    const { year, month } = this.getDatePathParts(meta.publishedAt);
                    const baseDir = path.join(__dirname, '..', '..', '..', 'data', 'sites', 'geeknews', year, month);
                    const htmlDir = path.join(baseDir, 'html');
                    const mdDir = path.join(baseDir, 'markdown');
                    fs.mkdirSync(htmlDir, { recursive: true });
                    fs.mkdirSync(mdDir, { recursive: true });
                    const htmlPath = path.join(htmlDir, `${id}.html`);
                    const mdPath = path.join(mdDir, `${id}.md`);
                    fs.writeFileSync(htmlPath, rawHtml, 'utf-8');
                    await converter.prettifyAndSave(meta.rawContent, mdPath);

                    processed++;
                    if (processed % 10 === 0) {
                        console.log(`🔄 Processed ${processed}/${docs.length} articles...`);
                    }
                } catch (err: any) {
                    console.error(`❌ Error backfilling GeekNews ID ${id}: ${err.message}`);
                }
            }
            console.log(`✨ Backfill complete! Successfully processed ${processed} articles.`);
        } catch (err: any) {
            console.error('❌ Backfill failed:', err);
        } finally {
            await mongo.close();
        }
    }

    private getDatePathParts(publishedAt: string | null): { year: string; month: string } {
        if (publishedAt) {
            const d = new Date(publishedAt);
            if (!isNaN(d.getTime())) {
                return {
                    year: d.getFullYear().toString(),
                    month: String(d.getMonth() + 1).padStart(2, '0')
                };
            }
        }
        return { year: 'unknown', month: 'unknown' };
    }
}

if (require.main === module) {
    const refresh = new GeekNewsRefresh();
    refresh.run().catch(console.error).then(() => process.exit(0));
}
