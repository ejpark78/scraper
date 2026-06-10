import { MongoDatabase } from '../../database/mongo';
import { getSite } from '../core/SiteRegistry';

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

    await collection.updateOne(
      { [tl.filterField]: id },
      { $set: doc },
      { upsert: true }
    );
  }
}
