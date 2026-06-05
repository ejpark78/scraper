import * as fs from 'fs';
import * as path from 'path';
import { BasePipeline } from '../core/BasePipeline';
import { GeekNewsMeta, GeekNewsConverter } from './GeekNewsConverter';

export class GeekNewsPipeline extends BasePipeline<GeekNewsMeta> {
    private readonly converter: GeekNewsConverter;

    constructor() {
        super();
        this.converter = new GeekNewsConverter();
    }

    protected extractId(url: string): string {
        // e.g. https://news.hada.io/topic?id=32402 -> 32402
        if (url.includes('id=')) {
            return url.split('id=').pop()!.split('&')[0];
        }
        // fallback to MD5 hash if not standard ID url
        const crypto = require('crypto');
        return crypto.createHash('md5').update(url).digest('hex').substring(0, 10);
    }

    protected getDomainName(): string {
        return '긱뉴스';
    }

    protected async executeScrape(url: string, tempHtmlPath: string): Promise<void> {
        console.log(`🌐 [GeekNews Fetch] Fetching ${url} ...`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch GeekNews topic details. Status: ${response.status}`);
        }
        const html = await response.text();
        fs.writeFileSync(tempHtmlPath, html, 'utf-8');
    }

    protected processMetadata(htmlContent: string, id: string, url: string): GeekNewsMeta {
        return this.converter.convertHtmlToMarkdown(htmlContent, id, url);
    }

    protected async saveResults(meta: GeekNewsMeta, id: string, tempHtmlPath: string, _redisInstance?: any): Promise<{ targetDirName: string }> {
        const rawHtml = fs.readFileSync(tempHtmlPath, 'utf-8');

        // ⚡ [MongoDB 적재] ⚡
        try {
            const { MongoDatabase } = require('../database/mongo');
            const dbInstance = MongoDatabase.getInstance();

            // 1. Bronze Layer (Raw HTML) 저장
            const bronzeGeeknews = await dbInstance.getCollection('bronze.geeknews');
            await bronzeGeeknews.updateOne(
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
            const silverGeeknews = await dbInstance.getCollection('silver.geeknews');
            await silverGeeknews.updateOne(
                { id: id },
                {
                    $set: {
                        id: id,
                        title: meta.title,
                        url: meta.url,
                        content: meta.content,
                        comments: meta.comments,
                        jsonLdRaw: meta.jsonLdRaw,
                        markdown: meta.rawContent,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
            console.log(`📡 [MongoDB Write] Successfully saved GeekNews ID ${id} to bronze.geeknews and silver.geeknews.`);

            // 3. Local File System Backup
            const baseDir = path.join(__dirname, '..', '..', 'data', 'geeknews');
            const htmlPath = path.join(baseDir, 'html', `${id}.html`);
            const mdPath = path.join(baseDir, 'markdown', `${id}.md`);

            // Ensure directories exist
            fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
            fs.mkdirSync(path.dirname(mdPath), { recursive: true });

            // Save HTML
            fs.writeFileSync(htmlPath, rawHtml, 'utf-8');

            // Prettify & Save Markdown
            await this.converter.prettifyAndSave(meta.rawContent, mdPath);
            console.log(`💾 [Local Write] Saved GeekNews ID ${id} locally to html/ and markdown/`);

        } catch (dbErr: any) {
            console.error(`❌ [GeekNews Save Error] Failed to save GeekNews ${id}: ${dbErr.message}`);
            throw dbErr;
        } finally {
            if (fs.existsSync(tempHtmlPath)) {
                fs.unlinkSync(tempHtmlPath);
            }
        }

        return {
            targetDirName: 'geeknews'
        };
    }
}

if (require.main === module) {
    const urlsFile = process.argv[2];
    const pipeline = new GeekNewsPipeline();
    pipeline.run(urlsFile).catch(err => {
        console.error('Fatal GeekNews pipeline crash:', err);
        process.exit(1);
    });
}

