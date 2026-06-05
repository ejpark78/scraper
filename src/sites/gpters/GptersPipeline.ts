import * as fs from 'fs';
import * as path from 'path';
import { BasePipeline } from '../../core/BasePipeline';
import { GptersMeta, GptersConverter } from './GptersConverter';

export class GptersPipeline extends BasePipeline<GptersMeta> {
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
        console.log(`🌐 [GPTERS GraphQL Fetch] Fetching single post ID: ${id} ...`);

        const query = `
        query getPost($id: ID!) {
          post(id: $id) {
            id
            title
            slug
            createdAt
            author {
              name
            }
            reactionsCount
            repliesCount
            shortContent
          }
        }
        `;

        const response = await fetch('https://api.bettermode.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                query,
                variables: { id }
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch GPTERS post details via GraphQL. Status: ${response.status}`);
        }

        const resJson = await response.json();
        const post = resJson.data?.post;
        if (!post) {
            throw new Error(`GPTERS post ID ${id} not found in GraphQL response`);
        }

        fs.writeFileSync(tempHtmlPath, JSON.stringify(post), 'utf-8');
    }

    protected processMetadata(htmlContent: string, id: string, url: string): GptersMeta {
        return this.converter.convertHtmlToMarkdown(htmlContent, id, url);
    }

    protected async saveResults(meta: GptersMeta, id: string, tempHtmlPath: string, _redisInstance?: any): Promise<{ targetDirName: string }> {
        const rawJson = fs.readFileSync(tempHtmlPath, 'utf-8');

        try {
            const { MongoDatabase } = require('../database/mongo');
            const dbInstance = MongoDatabase.getInstance();

            // 1. Bronze Layer (Raw JSON) 저장
            const bronzeGpters = await dbInstance.getCollection('bronze.gpters');
            await bronzeGpters.updateOne(
                { id: id },
                {
                    $set: {
                        id: id,
                        url: meta.url,
                        rawJson: JSON.parse(rawJson),
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
            console.log(`📡 [MongoDB Write] Successfully saved GPTERS ID ${id} to bronze.gpters and silver.gpters.`);

            // 3. Local File System Backup
            const baseDir = path.join(__dirname, '..', '..', 'data', 'gpters');
            const jsonPath = path.join(baseDir, 'json', `${id}.json`);
            const mdPath = path.join(baseDir, 'markdown', `${id}.md`);

            // Ensure directories exist
            fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
            fs.mkdirSync(path.dirname(mdPath), { recursive: true });

            // Save JSON
            fs.writeFileSync(jsonPath, rawJson, 'utf-8');

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
    const pipeline = new GptersPipeline();
    pipeline.run(urlsFile).catch(err => {
        console.error('Fatal GPTERS pipeline crash:', err);
        process.exit(1);
    });
}

