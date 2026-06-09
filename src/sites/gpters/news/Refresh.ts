import { MongoDatabase } from '../../../database/mongo';
import { GptersConverter, GptersMeta } from '../Converter';
import * as fs from 'fs';
import * as path from 'path';

export class GptersRefresh {
    public async run(): Promise<void> {
        console.log('🏁 [GPTERS Backfill] Starting comprehensive database-to-database backfill...');
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        try {
            const bronzeGpters = await mongo.getCollection('bronze/gpters.html');
            const silverGpters = await mongo.getCollection('silver/gpters.contents');

            const converter = new GptersConverter();
            const cursor = bronzeGpters.find({});
            const docs = await cursor.toArray();
            console.log(`📥 Loaded ${docs.length} raw posts from bronze.gpters.`);

            let processed = 0;
            for (const doc of docs) {
                const { id, rawHtml, rawJson, url } = doc;
                if (!id) continue;
                // Accept both rawHtml (JSON string from ScraperWorker) and rawJson (parsed object from Contents.ts)
                let post: any;
                if (rawHtml) {
                    try { post = JSON.parse(rawHtml); } catch { post = rawHtml; }
                } else if (rawJson) {
                    post = rawJson;
                } else {
                    continue;
                }

                let rawJsonStr = '';
                try {
                    // 1. Convert to Markdown
                    let meta: GptersMeta;
                    if (typeof post === 'object') {
                        rawJsonStr = JSON.stringify(post);
                        meta = converter.convertHtmlToMarkdown(rawJsonStr, id, url || '');
                    } else {
                        rawJsonStr = String(post);
                        meta = converter.convertHtmlToMarkdown(rawJsonStr, id, url || '');
                    }
                    const { year, month } = this.getDatePathParts(meta.publishedAt);

                    // 1b. Download images and update markdown URLs
                    try {
                        const fieldsMap: Record<string, string> = {};
                        if (post && typeof post === 'object' && Array.isArray(post.fields)) {
                            for (const f of post.fields) {
                                fieldsMap[f.key] = f.value;
                            }
                        }
                        const htmlContent = (post && typeof post === 'object' ? (fieldsMap.content || post.shortContent || '') : String(post)).replace(/\\(["nrt\\])/g, (_: string, c: string) => ({ '"': '"', 'n': '\n', 'r': '\r', 't': '\t', '\\': '\\' } as Record<string, string>)[c] || _);

                        const imageBaseDir = path.join(__dirname, '..', '..', '..', '..', 'data', 'sites', 'gpters', year, month, 'images', id);
                        fs.mkdirSync(imageBaseDir, { recursive: true });

                        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
                        let match;
                        const processedUrls = new Map<string, string>();
                        const skippedFavicons = new Set<string>();

                        while ((match = imgRegex.exec(htmlContent)) !== null) {
                            const originalSrc = match[1];
                            if (processedUrls.has(originalSrc)) continue;
                            if (originalSrc.startsWith('data:')) {
                                processedUrls.set(originalSrc, originalSrc);
                                continue;
                            }

                            // Skip favicon images
                            const lowerSrc = originalSrc.toLowerCase();
                            if (lowerSrc.includes('favicon') || lowerSrc.endsWith('.ico')) {
                                skippedFavicons.add(originalSrc);
                                continue;
                            }

                            // Vercel _next/image — not downloadable server-side, keep original URL for browser
                            if (lowerSrc.includes('_next/image')) {
                                processedUrls.set(originalSrc, originalSrc);
                                continue;
                            }

                            let absoluteUrl = originalSrc;
                            if (originalSrc.startsWith('//')) {
                                absoluteUrl = 'https:' + originalSrc;
                            } else if (originalSrc.startsWith('/')) {
                                absoluteUrl = 'https://www.gpters.org' + originalSrc;
                            } else if (!/^https?:\/\//i.test(originalSrc)) {
                                absoluteUrl = 'https://www.gpters.org/' + originalSrc;
                            }

                            try {
                                const response = await fetch(absoluteUrl, {
                                    headers: {
                                        Referer: url,
                                        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                        Accept: 'image/webp,image/avif,image/*,*/*;q=0.8',
                                    }
                                });
                                if (!response.ok) {
                                    const respHeaders = Array.from(response.headers.entries()).map(([k, v]) => `${k}: ${v}`).join('\n          ');
                                    console.warn(`⚠️ [GPTers Image] HTTP ${response.status}
          doc : ${url}
          img : ${absoluteUrl}
          headers:
          ${respHeaders}`);
                                    continue;
                                }
                                const arrayBuffer = await response.arrayBuffer();
                                const buffer = Buffer.from(arrayBuffer);
                                const contentType = response.headers.get('content-type') || '';
                                const ext = contentType.includes('png') ? '.png'
                                    : contentType.includes('gif') ? '.gif'
                                    : contentType.includes('webp') ? '.webp'
                                    : contentType.includes('svg') ? '.svg'
                                    : '.jpg';
                                const filename = `img_${processedUrls.size}${ext}`;
                                fs.writeFileSync(path.join(imageBaseDir, filename), buffer);
                                processedUrls.set(originalSrc, `/gpters/${year}/${month}/images/${id}/${filename}`);
                            } catch (imgErr: any) {
                                console.warn(`⚠️ [GPTers Image] Failed to download
          doc : ${url}
          img : ${absoluteUrl}
          err : ${imgErr.message}`);
                            }
                        }

                        if (processedUrls.size > 0 || skippedFavicons.size > 0) {
                            let updatedMarkdown = meta.rawContent;
                            for (const [originalSrc, localUrl] of processedUrls) {
                                if (originalSrc === localUrl) continue;
                                const escaped = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                updatedMarkdown = updatedMarkdown.replace(new RegExp(escaped, 'g'), localUrl);
                            }
                            for (const faviconUrl of skippedFavicons) {
                                const escaped = faviconUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                updatedMarkdown = updatedMarkdown.replace(new RegExp(`!\\[.*?\\]\\(${escaped}\\)`, 'g'), '');
                            }
                            meta = { ...meta, rawContent: updatedMarkdown };
                        }
                    } catch (imgErr: any) {
                        console.warn(`⚠️ [GPTers Image Processing] Error in backfill: ${imgErr.message}`);
                    }

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
                    const baseDir = path.join(__dirname, '..', '..', '..', '..', 'data', 'sites', 'gpters', year, month);
                    const jsonPath = path.join(baseDir, 'json', `${id}.json`);
                    const mdPath = path.join(baseDir, 'markdown', `${id}.md`);
                    await converter.prettifyJsonAndSave(rawJsonStr, jsonPath);
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
    const refresh = new GptersRefresh();
    refresh.run().catch(console.error).then(() => process.exit(0));
}
