/**
 * @module TargetLoader
 * @description Core functionality or script runner for TargetLoader.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies mongo, SiteRegistry
 * @lastUpdated 2026-06-11
 */

import { MongoDatabase } from '../../database/mongo';
import { getSite } from '../core/SiteRegistry';
import { MeiliSearchDatabase } from '../../database/meili';

export class TargetLoader {
  public static async load(site: string, id: string, meta: any): Promise<void> {
    const mongo = MongoDatabase.getInstance();
    const desc = getSite(site);

    if (!desc?.targetLoader) {
      throw new Error(`No target loader configuration for site: ${site}`);
    }

    const tl = desc.targetLoader;
    const collection = await mongo.getCollection(tl.collectionName);
    const doc = tl.buildDocument(id, meta);

    // 1. Update MongoDB Silver Database
    await collection.updateOne(
      { [tl.filterField]: id },
      { $set: doc },
      { upsert: true }
    );

    // 2. Index to Meilisearch
    try {
      const meili = MeiliSearchDatabase.getInstance();
      const meiliDoc = {
        id: `${site}_${id}`, // Unique composite ID
        site: site,
        docId: id,
        title: doc.title || doc.jobTitle || 'Untitled',
        companyName: doc.companyName || null,
        location: doc.location || null,
        geo: doc.geo || 'Unknown',
        content: doc.description || doc.markdown || doc.content || '',
        url: doc.url || null,
        publishedAt: doc.publishedAt || doc.collectedAt || doc.createdAt || doc.scrapedAt || doc.updatedAt || new Date().toISOString(),
        updatedAt: doc.updatedAt || new Date().toISOString()
      };

      await meili.addDocuments('contents', [meiliDoc]);
    } catch (meiliErr: any) {
      console.warn(`⚠️ [Meilisearch] Failed to index document ${site}_${id}: ${meiliErr.message}`);
    }
  }
}
