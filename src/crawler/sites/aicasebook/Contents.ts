import * as fs from 'fs';
import * as path from 'path';
import { BasePipeline } from '../../core/BasePipeline';
import { AiCasebookMeta, AiCasebookConverter } from './Converter';

export class AiCasebookContents extends BasePipeline<AiCasebookMeta> {
  private readonly converter: AiCasebookConverter;

  constructor() {
    super();
    this.converter = new AiCasebookConverter();
  }

  protected extractId(url: string): string {
    const match = url.match(/\/setup\/(\d+)/);
    return match ? match[1] : '';
  }

  protected getDomainName(): string {
    return 'aicasebook.dev';
  }

  protected async executeScrape(url: string, tempHtmlPath: string): Promise<void> {
    console.log(`🌐 [AiCasebook Fetch] Fetching ${url} ...`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch aicasebook.dev details. Status: ${response.status}`);
    }
    const html = await response.text();
    fs.writeFileSync(tempHtmlPath, html, 'utf-8');
  }

  protected processMetadata(htmlContent: string, id: string, url: string): AiCasebookMeta {
    return this.converter.convertHtmlToMarkdown(htmlContent, id, url);
  }

  private getDatePathParts(publishedAt: string | null): { year: string; month: string } {
    if (publishedAt) {
      const d = new Date(publishedAt);
      if (!isNaN(d.getTime())) {
        return {
          year: d.getFullYear().toString(),
          month: String(d.getMonth() + 1).padStart(2, '0'),
        };
      }
    }
    return { year: 'unknown', month: 'unknown' };
  }

  protected async saveResults(meta: AiCasebookMeta, id: string, tempHtmlPath: string): Promise<{ targetDirName: string }> {
    const { MongoDatabase } = require('../../../database/mongo');
    const dbInstance = MongoDatabase.getInstance();
    const rawHtml = fs.readFileSync(tempHtmlPath, 'utf-8');

    try {
      const bronzeColl = await dbInstance.getCollection('bronze/aicasebook.html');
      await bronzeColl.updateOne(
        { id },
        {
          $set: {
            id,
            url: meta.url,
            rawHtml,
            collectedAt: new Date(),
          },
        },
        { upsert: true }
      );

      const silverColl = await dbInstance.getCollection('silver/aicasebook.contents');
      await silverColl.updateOne(
        { id },
        {
          $set: {
            id,
            title: meta.title,
            url: meta.url,
            summary: meta.summary,
            author: meta.author,
            categories: meta.categories,
            tags: meta.tags,
            publishedAt: meta.publishedAt,
            views: meta.views,
            sourceLink: meta.sourceLink,
            seriesName: meta.seriesName,
            body: meta.body,
            markdown: meta.rawContent,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      const urlsColl = await dbInstance.getCollection('bronze/aicasebook.urls');
      await urlsColl.updateOne(
        { id },
        { $set: { status: 'completed', updatedAt: new Date() } }
      );

      console.log(`📡 [MongoDB Write] Successfully saved AiCasebook ID ${id}`);

      const { year, month } = this.getDatePathParts(meta.publishedAt);
      const baseDir = path.join(__dirname, '..', '..', 'data', 'sites', 'aicasebook', year, month);
      const htmlPath = path.join(baseDir, 'html', `${id}.html`);
      const mdPath = path.join(baseDir, 'markdown', `${id}.md`);

      fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
      fs.mkdirSync(path.dirname(mdPath), { recursive: true });

      fs.writeFileSync(htmlPath, rawHtml, 'utf-8');
      await this.converter.prettifyAndSave(meta.rawContent, mdPath);
      console.log(`💾 [Local Write] Saved AiCasebook ID ${id} locally to html/ and markdown/`);
    } catch (dbErr: any) {
      console.error(`❌ [AiCasebook Save Error] Failed to save ${id}: ${dbErr.message}`);
      throw dbErr;
    } finally {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    }

    return { targetDirName: 'aicasebook' };
  }
}

if (require.main === module) {
  const urlsFile = process.argv[2];
  const contents = new AiCasebookContents();
  contents.run(urlsFile).catch(err => {
    console.error('Fatal AiCasebook contents pipeline crash:', err);
    process.exit(1);
  });
}
