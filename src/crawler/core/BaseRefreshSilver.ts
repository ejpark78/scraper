import * as fs from 'fs';
import * as path from 'path';
import { MongoDatabase } from '../../database/mongo';
import { IConverter } from './IConverter';

export interface BaseRefreshSilverConfig {
  site: string;
  bronzeCollection: `bronze/${string}`;
  silverCollection: `silver/${string}`;
  dataDir: string;
  converter: IConverter<any>;
  extractId?: (doc: any) => string;
  extractRawContent?: (doc: any) => string;
  saveJson?: boolean;
  getSilverFields?: (meta: any) => Record<string, any>;
  afterConvert?: (meta: any, rawContent: string, doc: any) => Promise<any>;
}

export class BaseRefreshSilver {
  private readonly config: BaseRefreshSilverConfig;

    constructor(config: BaseRefreshSilverConfig) {
      this.config = {
        ...config,
        extractId: config.extractId || ((doc) => doc.topicId || doc.id || ''),
        extractRawContent: config.extractRawContent || ((doc) => doc.rawHtml || doc.rawJson || ''),
        getSilverFields: config.getSilverFields || ((meta) => ({
          id: meta.id,
          title: meta.title,
          url: meta.url,
          publishedAt: meta.publishedAt,
          content: meta.content,
          markdown: meta.rawContent,
          updatedAt: new Date(),
        })),
      };
    }

  public async run(): Promise<void> {
    const { site, bronzeCollection, silverCollection, dataDir } = this.config;
    console.log(`🏁 [${site} Refresh] Starting bronze-to-silver backfill...`);

    const mongo = MongoDatabase.getInstance();
    await mongo.connect();

    try {
      const bronzeColl = await mongo.getCollection(bronzeCollection);
      const silverColl = await mongo.getCollection(silverCollection);

      const bronzeCursor = bronzeColl.find({});
      let processed = 0;
      let total = 0;

      for await (const doc of bronzeCursor) {
        total++;
        const id = this.config.extractId!(doc);
        const rawContent = this.config.extractRawContent!(doc);
        if (!id || !rawContent) continue;

        try {
          let meta = this.config.converter.convertHtmlToMarkdown(
            rawContent, id, doc.url || '',
          );

          if (this.config.afterConvert) {
            meta = await this.config.afterConvert(meta, rawContent, doc);
          }

          await silverColl.updateOne(
            { id },
            { $set: this.config.getSilverFields!(meta) },
            { upsert: true },
          );

          await this.saveLocalFiles(meta, rawContent, id);

          processed++;
          if (processed % 10 === 0) {
            console.log(`🔄 [${site}] Processed ${processed}...`);
          }
        } catch (err: any) {
          console.error(`❌ [${site}] Error processing ID ${id}: ${err.message}`);
        }
      }
      console.log(`✨ [${site} Refresh] Complete! Processed ${processed}/${total} documents.`);
    } catch (err: any) {
      console.error(`❌ [${site} Refresh] Failed: ${err.message}`);
    } finally {
      await mongo.close();
    }
  }

  private async saveLocalFiles(meta: any, rawContent: string, id: string): Promise<void> {
    const { publishedAt } = meta;
    let year = 'unknown';
    let month = 'unknown';
    if (publishedAt) {
      const d = new Date(publishedAt);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear().toString();
        month = String(d.getMonth() + 1).padStart(2, '0');
      }
    }

    const baseDir = path.join(
      __dirname, '..', '..', '..', 'data', 'sites',
      this.config.dataDir, year, month,
    );

    const htmlDir = path.join(baseDir, 'html');
    const mdDir = path.join(baseDir, 'markdown');
    fs.mkdirSync(htmlDir, { recursive: true });
    fs.mkdirSync(mdDir, { recursive: true });

    fs.writeFileSync(path.join(htmlDir, `${id}.html`), rawContent, 'utf-8');
    await this.config.converter.prettifyAndSave(meta.rawContent, path.join(mdDir, `${id}.md`));

    if (this.config.saveJson) {
      const jsonDir = path.join(baseDir, 'json');
      fs.mkdirSync(jsonDir, { recursive: true });
      fs.writeFileSync(path.join(jsonDir, `${id}.json`), rawContent, 'utf-8');
    }
  }
}
