import { MongoDatabase } from '../../../database/mongo';
import { GptersConverter } from '../Converter';
import * as fs from 'fs';
import * as path from 'path';

const COLLECTION_PREFIX = 'gpters_newsletter';
const SITE_DIR = 'gpters_newsletter';

export class GptersNewsletterRefresh {
    public async run(): Promise<void> {
        console.log('🏁 [GPTERS Newsletter Refresh] Starting bronze-to-silver backfill...');
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        try {
            const bronzeColl = await mongo.getCollection(`bronze/${COLLECTION_PREFIX}.html`);
            const silverColl = await mongo.getCollection(`silver/${COLLECTION_PREFIX}.contents`);

            const converter = new GptersConverter();
            const cursor = bronzeColl.find({});
            const docs = await cursor.toArray();
            console.log(`📥 Loaded ${docs.length} raw articles from bronze/${COLLECTION_PREFIX}.html.`);

            let processed = 0;
            for (const doc of docs) {
                const id = doc.id || doc.postId;
                const { rawJson, url } = doc;
                if (!id || !rawJson) continue;

                try {
                    const rawContent = typeof rawJson === 'string' ? rawJson : JSON.stringify(rawJson);
                    const meta = converter.convertHtmlToMarkdown(rawContent, id, url || '');

                    await silverColl.updateOne(
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

                    const { year, month } = this.getDatePathParts(meta.publishedAt);
                    const baseDir = path.join(__dirname, '..', '..', '..', '..', 'data', 'sites', SITE_DIR, year, month);
                    const jsonDir = path.join(baseDir, 'json');
                    const mdDir = path.join(baseDir, 'markdown');
                    fs.mkdirSync(jsonDir, { recursive: true });
                    fs.mkdirSync(mdDir, { recursive: true });

                    const jsonPath = path.join(jsonDir, `${id}.json`);
                    const mdPath = path.join(mdDir, `${id}.md`);

                    await converter.prettifyJsonAndSave(rawContent, jsonPath);
                    await converter.prettifyAndSave(meta.rawContent, mdPath);

                    processed++;
                    if (processed % 10 === 0) {
                        console.log(`🔄 Processed ${processed}/${docs.length} articles...`);
                    }
                } catch (err: any) {
                    console.error(`❌ Error backfilling GPTERS Newsletter ID ${id}: ${err.message}`);
                }
            }
            console.log(`✨ [GPTERS Newsletter Refresh] Complete! Processed ${processed} articles.`);
        } catch (err: any) {
            console.error('❌ Refresh failed:', err);
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
    const refresh = new GptersNewsletterRefresh();
    refresh.run().catch(console.error).then(() => process.exit(0));
}
