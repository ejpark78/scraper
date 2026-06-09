import * as fs from 'fs';
import * as path from 'path';
import { BasePipeline } from '../../core/BasePipeline';
import { PyTorchKRMeta, PyTorchKRConverter } from './Converter';
import { getBrowser, closeBrowser } from '../../browser/pool';

export class PyTorchKRContents extends BasePipeline<PyTorchKRMeta> {
    private readonly converter: PyTorchKRConverter;

    constructor() {
        super();
        this.converter = new PyTorchKRConverter();
    }

    protected extractId(url: string): string {
        // e.g. https://discuss.pytorch.kr/t/slug-name/1234 -> 1234
        // Extract the last numeric segment from URL path
        const match = url.match(/\/(\d+)(?:\?|$)/);
        if (match) {
            return match[1];
        }
        const crypto = require('crypto');
        return crypto.createHash('md5').update(url).digest('hex').substring(0, 10);
    }

    protected getDomainName(): string {
        return '파이토치KR';
    }

    protected async executeScrape(url: string, tempHtmlPath: string): Promise<void> {
        console.log(`🌐 [PyTorch KR Fetch] Loading page with Playwright: ${url} ...`);
        const browser = await getBrowser();
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 },
        });
        const page = await context.newPage();

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for Discourse post content to render (Onebox transformations + lazy images)
            await page.waitForSelector('.cooked', { timeout: 15000 });
            await new Promise(r => setTimeout(r, 2000));

            const result = await page.evaluate(() => {
                const cooked = document.querySelector('.cooked');
                const ogTitle = document.querySelector('meta[property="og:title"]');
                const ogTime = document.querySelector('meta[property="article:published_time"]');
                const topicTitle = document.querySelector('h1');
                let title = '';
                if (topicTitle) {
                    title = topicTitle.textContent?.trim() || '';
                } else if (ogTitle) {
                    title = ogTitle.getAttribute('content') || '';
                } else {
                    title = document.title.replace(/\s*-\s*[^-]*$/, '').trim();
                }
                return {
                    cookedHtml: cooked ? cooked.innerHTML : '',
                    title,
                    createdAt: ogTime ? ogTime.getAttribute('content') || '' : '',
                };
            });

            if (!result.cookedHtml) {
                throw new Error(`No cooked content found on page for ${url}`);
            }

            const html = `<!DOCTYPE html>
<html>
<head><title>${result.title.replace(/</g, '&lt;')} - PyTorchKR</title>
<link rel="canonical" href="${url}">
<meta property="article:published_time" content="${result.createdAt}">
</head>
<body>
<div class="post" itemprop="text">${result.cookedHtml}</div>
</body>
</html>`;

            fs.writeFileSync(tempHtmlPath, html, 'utf-8');
        } finally {
            await page.close();
            await context.close();
        }
    }

    protected processMetadata(htmlContent: string, id: string, url: string): PyTorchKRMeta {
        return this.converter.convertHtmlToMarkdown(htmlContent, id, url);
    }

    protected async saveResults(meta: PyTorchKRMeta, id: string, tempHtmlPath: string, _redisInstance?: any): Promise<{ targetDirName: string }> {
        const rawHtml = fs.readFileSync(tempHtmlPath, 'utf-8');

        // Download images from rawHtml and replace URLs in markdown
        let updatedMarkdown = meta.rawContent;
        try {
            const projectRoot = path.resolve(__dirname, '..', '..', '..');
            const imageBaseDir = path.join(projectRoot, 'data', 'sites', 'images', 'pytorch_kr', id);
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
                            Referer: meta.url,
                            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            Accept: 'image/webp,image/avif,image/*,*/*;q=0.8',
                        }
                    });
                    if (!response.ok) {
                        const respHeaders = Array.from(response.headers.entries()).map(([k, v]) => `${k}: ${v}`).join('\n          ');
                        console.warn(`⚠️ [PyTorch KR Image] HTTP ${response.status}
          doc : ${meta.url}
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
                    processedUrls.set(originalSrc, `/images/pytorch_kr/${id}/${filename}`);
                    console.log(`✅ [PyTorch KR Image] Saved ${filename} (${buffer.length} bytes) from ${absoluteUrl}`);
                } catch (err: any) {
                    console.warn(`⚠️ [PyTorch KR Image] Failed to download
          doc : ${meta.url}
          img : ${absoluteUrl}
          err : ${err.message}`);
                }
            }

            if (processedUrls.size > 0 || skippedFavicons.size > 0) {
                for (const [originalSrc, localUrl] of processedUrls) {
                    if (originalSrc === localUrl) continue;
                    const escaped = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    updatedMarkdown = updatedMarkdown.replace(new RegExp(escaped, 'g'), localUrl);
                }
                for (const faviconUrl of skippedFavicons) {
                    const escaped = faviconUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    updatedMarkdown = updatedMarkdown.replace(new RegExp(`!\\[.*?\\]\\(${escaped}\\)`, 'g'), '');
                }
                meta.rawContent = updatedMarkdown;
            }
        } catch (imgErr: any) {
            console.warn(`⚠️ [PyTorch KR Image Processing] Error: ${imgErr.message}`);
        }

        try {
            const { MongoDatabase } = require('../database/mongo');
            const dbInstance = MongoDatabase.getInstance();

            // 1. Bronze Layer (Raw HTML) 저장
            const bronzePytorch = await dbInstance.getCollection('bronze/pytorch_kr.html');
            await bronzePytorch.updateOne(
                { id: id },
                {
                    $set: {
                        id: id,
                        url: meta.url,
                        rawHtml: rawHtml,
                        collectedAt: new Date()
                    }
                },
                { upsert: true }
            );

            // 2. Silver Layer (Cleansed Metadata & Markdown) 저장
            const silverPytorch = await dbInstance.getCollection('silver/pytorch_kr.contents');
            await silverPytorch.updateOne(
                { id: id },
                {
                    $set: {
                        id: id,
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

            // 3. Update status in bronze.pytorch_kr_urls
            const pytorchUrlsColl = await dbInstance.getCollection('bronze/pytorch_kr.urls');
            await pytorchUrlsColl.updateOne(
                { id },
                { $set: { status: 'completed', updatedAt: new Date() } }
            );

            console.log(`📡 [MongoDB Write] Successfully saved PyTorch KR ID ${id} and marked url as completed.`);

            // 4. Local File System Backup
            const projectRoot = path.resolve(__dirname, '..', '..', '..');
            const baseDir = path.join(projectRoot, 'data', 'sites', 'pytorch_kr');
            const htmlPath = path.join(baseDir, 'html', `${id}.html`);
            const mdPath = path.join(baseDir, 'markdown', `${id}.md`);

            // Ensure directories exist
            fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
            fs.mkdirSync(path.dirname(mdPath), { recursive: true });

            // Save HTML
            fs.writeFileSync(htmlPath, rawHtml, 'utf-8');

            // Save Markdown
            await this.converter.prettifyAndSave(meta.rawContent, mdPath);
            console.log(`💾 [Local Write] Saved PyTorch KR ID ${id} locally to html/ and markdown/`);

        } catch (dbErr: any) {
            console.error(`❌ [PyTorch KR Save Error] Failed to save PyTorch KR ${id}: ${dbErr.message}`);
            throw dbErr;
        } finally {
            if (fs.existsSync(tempHtmlPath)) {
                fs.unlinkSync(tempHtmlPath);
            }
        }

        return {
            targetDirName: 'pytorch_kr'
        };
    }
}

if (require.main === module) {
    const urlsFile = process.argv[2];
    const contents = new PyTorchKRContents();
    contents.run(urlsFile).catch(err => {
        console.error('Fatal PyTorch KR contents crash:', err);
        process.exit(1);
    });
}

