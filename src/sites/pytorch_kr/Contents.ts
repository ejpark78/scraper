import * as fs from 'fs';
import * as path from 'path';
import { BasePipeline } from '../../core/BasePipeline';
import { PyTorchKRMeta, PyTorchKRConverter } from './Converter';

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
        console.log(`🌐 [PyTorch KR Fetch] Fetching ${url} ...`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch PyTorch KR details. Status: ${response.status}`);
        }
        const html = await response.text();
        fs.writeFileSync(tempHtmlPath, html, 'utf-8');
    }

    protected processMetadata(htmlContent: string, id: string, url: string): PyTorchKRMeta {
        return this.converter.convertHtmlToMarkdown(htmlContent, id, url);
    }

    protected async saveResults(meta: PyTorchKRMeta, id: string, tempHtmlPath: string, _redisInstance?: any): Promise<{ targetDirName: string }> {
        const rawHtml = fs.readFileSync(tempHtmlPath, 'utf-8');

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

            // 3. Local File System Backup
            const baseDir = path.join(__dirname, '..', '..', 'data', 'pytorch_kr');
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

