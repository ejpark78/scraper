import { MongoDatabase } from '../../database/mongo';
import { PyTorchKRConverter } from './Converter';
import * as fs from 'fs';
import * as path from 'path';

export class PyTorchKRRefresh {
    public async run(): Promise<void> {
        console.log('🏁 [PyTorch KR Backfill] Starting comprehensive database-to-database backfill...');
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        try {
            const bronzePytorch = await mongo.getCollection('bronze/pytorch_kr.html');
            const silverPytorch = await mongo.getCollection('silver/pytorch_kr.contents');

            const converter = new PyTorchKRConverter();
            const cursor = bronzePytorch.find({});
            const totalDocs = await bronzePytorch.countDocuments({});
            console.log(`📥 Found ${totalDocs} raw topics in bronze.pytorch_kr.`);

            let processed = 0;
            while (await cursor.hasNext()) {
                const doc = await cursor.next();
                if (!doc) continue;
                const { id, rawHtml, url } = doc;

                if (!id || !rawHtml) continue;

                try {
                    // 1. Convert to Markdown
                    let meta = converter.convertHtmlToMarkdown(rawHtml, id, url || '');
                    const { year, month } = this.getDatePathParts(meta.publishedAt);

                    // 1b. Download images and update markdown URLs
                    try {
                        const imageBaseDir = path.join(__dirname, '..', '..', '..', 'data', 'sites', 'pytorch_kr', year, month, 'images', id);
                        fs.mkdirSync(imageBaseDir, { recursive: true });

                        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
                        let match;
                        const processedUrls = new Map<string, string>();
                        const skippedFavicons = new Set<string>();

                        while ((match = imgRegex.exec(rawHtml)) !== null) {
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
                                absoluteUrl = 'https://discuss.pytorch.kr' + originalSrc;
                            } else if (!/^https?:\/\//i.test(originalSrc)) {
                                absoluteUrl = 'https://discuss.pytorch.kr/' + originalSrc;
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
                                    console.warn(`⚠️ [PyTorch KR Image] HTTP ${response.status}
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
                                processedUrls.set(originalSrc, `/pytorch_kr/${year}/${month}/images/${id}/${filename}`);
                            } catch (imgErr: any) {
                                console.warn(`⚠️ [PyTorch KR Image] Failed to download
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
                        console.warn(`⚠️ [PyTorch KR Image Processing] Error in backfill: ${imgErr.message}`);
                    }

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
                    const baseDir = path.join(__dirname, '..', '..', '..', 'data', 'sites', 'pytorch_kr', year, month);
                    const htmlPath = path.join(baseDir, 'html', `${id}.html`);
                    const mdPath = path.join(baseDir, 'markdown', `${id}.md`);
                    fs.writeFileSync(htmlPath, rawHtml, 'utf-8');
                    await converter.prettifyAndSave(meta.rawContent, mdPath);

                    processed++;
                    if (processed % 10 === 0) {
                        console.log(`🔄 Processed ${processed}/${totalDocs} topics...`);
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
    const refresh = new PyTorchKRRefresh();
    refresh.run().catch(console.error).then(() => process.exit(0));
}
