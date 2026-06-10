import * as fs from 'fs';
import * as path from 'path';
import { BasePipeline } from '../../../core/BasePipeline';
import { GptersMeta, GptersConverter } from '../Converter';

export class GptersContents extends BasePipeline<GptersMeta> {
    private readonly converter: GptersConverter;

    constructor() {
        super();
        this.converter = new GptersConverter();
    }

    protected extractId(url: string): string {
        // e.g. https://www.gpters.org/news/post/slug-name-postId
        // The post ID is usually the last part of the URL after the last dash
        const parts = url.split('-');
        const id = parts[parts.length - 1];
        if (id) {
            return id;
        }
        const crypto = require('crypto');
        return crypto.createHash('md5').update(url).digest('hex').substring(0, 10);
    }

    protected getDomainName(): string {
        return '지피터스';
    }

    protected async executeScrape(url: string, tempHtmlPath: string): Promise<void> {
        const id = this.extractId(url);

        console.log(`🌐 [GPTERS] Fetching guest access token...`);
        const tokenRes = await fetch('https://www.gpters.org/news');
        const tokenHtml = await tokenRes.text();
        const tokenMatch = tokenHtml.match(/accessToken":"([^"]+)"/);
        if (!tokenMatch) throw new Error('Failed to extract GPTERS guest access token');
        const token = tokenMatch[1];

        console.log(`🔑 [GPTERS GraphQL Fetch] Fetching single post ID: ${id} ...`);
        const query = `
        query getPost($id: ID!) {
          post(id: $id) {
            id
            title
            slug
            createdAt
            createdBy { member { name } }
            reactionsCount
            repliesCount
            shortContent
            fields { key value }
            space { id name slug }
          }
        }
        `;

        const response = await fetch('https://api.bettermode.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                query,
                variables: { id }
            })
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Failed to fetch GPTERS post details via GraphQL. Status: ${response.status}: ${body.slice(0, 200)}`);
        }

        const resJson = await response.json();
        const post = resJson.data?.post;
        if (!post) {
            throw new Error(`GPTERS post ID ${id} not found in GraphQL response`);
        }

        fs.writeFileSync(tempHtmlPath, JSON.stringify(post), 'utf-8');
    }

    protected async processMetadata(htmlContent: string, id: string, url: string): Promise<GptersMeta> {
        return this.converter.convertHtmlToMarkdown(htmlContent, id, url);
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

    protected async saveResults(meta: GptersMeta, id: string, tempHtmlPath: string, _redisInstance?: any): Promise<{ targetDirName: string }> {
        const { year, month } = this.getDatePathParts(meta.publishedAt);
        const rawJsonContent = fs.readFileSync(tempHtmlPath, 'utf-8');
        let parsedJson: any = {};
        try {
            parsedJson = JSON.parse(rawJsonContent);
        } catch { /* ignore */ }

        // Download images from HTML content and replace URLs in markdown
        let updatedMarkdown = meta.rawContent;
        try {
            const fieldsMap: Record<string, string> = {};
            if (Array.isArray(parsedJson.fields)) {
                for (const f of parsedJson.fields) {
                    fieldsMap[f.key] = f.value;
                }
            }
            const htmlContent = (fieldsMap.content || parsedJson.shortContent || '').replace(/\\(["nrt\\])/g, (_: string, c: string) => ({ '"': '"', 'n': '\n', 'r': '\r', 't': '\t', '\\': '\\' } as Record<string, string>)[c] || _);

            const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
            const imageBaseDir = path.join(projectRoot, 'data', 'sites', 'gpters', year, month, 'images', id);
            fs.mkdirSync(imageBaseDir, { recursive: true });

            const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
            let match;
            const processedUrls = new Map<string, string>();
            const skippedFavicons = new Set<string>();

            while ((match = imgRegex.exec(htmlContent)) !== null) {
                const originalSrc = match[1];
                if (processedUrls.has(originalSrc)) continue;

                // Skip data URIs
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

                // Resolve relative URLs
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
                            Referer: meta.url,
                            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            Accept: 'image/webp,image/avif,image/*,*/*;q=0.8',
                        }
                    });
                    if (!response.ok) {
                        const respHeaders = Array.from(response.headers.entries()).map(([k, v]) => `${k}: ${v}`).join('\n          ');
                        console.warn(`⚠️ [GPTers Image] HTTP ${response.status}
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
                    const filepath = path.join(imageBaseDir, filename);
                    fs.writeFileSync(filepath, buffer);

                    const localUrl = `/gpters/${year}/${month}/images/${id}/${filename}`;
                    processedUrls.set(originalSrc, localUrl);
                    console.log(`✅ [GPTers Image] Saved ${filename} (${buffer.length} bytes) from ${absoluteUrl}`);
                } catch (err: any) {
                    console.warn(`⚠️ [GPTers Image] Failed to download
          doc : ${meta.url}
          img : ${absoluteUrl}
          err : ${err.message}`);
                }
            }

            // Replace original URLs with local URLs in markdown
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
            console.warn(`⚠️ [GPTers Image Processing] Error: ${imgErr.message}`);
        }

        try {
            const { MongoDatabase } = require('../../../../database/mongo');
            const dbInstance = MongoDatabase.getInstance();

            // 1. Bronze Layer (Raw JSON) 저장
            const bronzeGpters = await dbInstance.getCollection('gpters.html');
            await bronzeGpters.updateOne(
                { id: id },
                {
                    $set: {
                        id: id,
                        url: meta.url,
                        rawJson: parsedJson,
                        collectedAt: new Date()
                    }
                },
                { upsert: true }
            );

            // 2. Silver Layer (Cleansed Metadata & Markdown) 저장
            const silverGpters = await dbInstance.getCollection('silver.gpters');
            await silverGpters.updateOne(
                { id: id },
                {
                    $set: {
                        id: id,
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

            // 3. Update status in bronze.gpters_urls
            const gptersUrlsColl = await dbInstance.getCollection('gpters.urls');
            await gptersUrlsColl.updateOne(
                { id },
                { $set: { status: 'completed', updatedAt: new Date() } }
            );

            console.log(`📡 [MongoDB Write] Successfully saved GPTERS ID ${id} and marked url as completed.`);

            // 4. Local File System Backup
            const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
            const baseDir = path.join(projectRoot, 'data', 'sites', 'gpters', year, month);
            const jsonPath = path.join(baseDir, 'json', `${id}.json`);
            const mdPath = path.join(baseDir, 'markdown', `${id}.md`);

            // Ensure directories exist
            fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
            fs.mkdirSync(path.dirname(mdPath), { recursive: true });

            // Save JSON
            await this.converter.prettifyJsonAndSave(rawJsonContent, jsonPath);

            // Save Markdown
            await this.converter.prettifyAndSave(meta.rawContent, mdPath);
            console.log(`💾 [Local Write] Saved GPTERS ID ${id} locally to json/ and markdown/`);

        } catch (dbErr: any) {
            console.error(`❌ [GPTERS Save Error] Failed to save GPTERS ${id}: ${dbErr.message}`);
            throw dbErr;
        } finally {
            if (fs.existsSync(tempHtmlPath)) {
                fs.unlinkSync(tempHtmlPath);
            }
        }

        return {
            targetDirName: 'gpters'
        };
    }
}

if (require.main === module) {
    const urlsFile = process.argv[2];
    const contents = new GptersContents();
    contents.run(urlsFile).catch(err => {
        console.error('Fatal GPTERS contents crash:', err);
        process.exit(1);
    });
}
