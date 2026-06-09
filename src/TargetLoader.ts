import { MongoDatabase } from './database/mongo';
import { UrlUtils, NamingUtils } from './utils';

export class TargetLoader {
  /**
   * 정제된 구조화 데이터를 MongoDB Silver Layer의 타겟 컬렉션에 적재합니다.
   */
  public static async load(site: string, id: string, meta: any): Promise<void> {
    const mongo = MongoDatabase.getInstance();

    if (site === 'linkedin') {
      const collection = await mongo.getCollection('silver/linkedin.jobs');
      const stdLoc = UrlUtils.standardizeLocation(meta.rawLocation);
      const companyId = meta.company ? NamingUtils.generateSafeFileName(meta.company, '') : null;

      const doc = {
        jobId: id,
        title: meta.jobTitle || 'Untitled',
        companyName: meta.company || null,
        companyId: companyId,
        description: meta.rawContent || null,
        location: meta.rawLocation || null,
        geo: stdLoc || 'Unknown',
        workStyle: '정보 없음',
        url: `https://www.linkedin.com/jobs/view/${id}`,
        updatedAt: new Date()
      };

      await collection.updateOne(
        { jobId: id },
        { $set: doc },
        { upsert: true }
      );

    } else if (site === 'linkedin_company') {
      const collection = await mongo.getCollection('silver/linkedin.companies');
      const doc = {
        companyId: id,
        companyName: meta.companyName || 'Unknown Company',
        tagline: meta.tagline || null,
        website: meta.website || null,
        industry: meta.industry || null,
        companySize: meta.companySize || null,
        description: meta.hqDescription || null,
        updatedAt: new Date()
      };

      await collection.updateOne(
        { companyId: id },
        { $set: doc },
        { upsert: true }
      );

    } else if (site === 'geeknews') {
      const collection = await mongo.getCollection('silver/geeknews.contents');
      const doc = {
        id: id,
        title: meta.title || 'Untitled',
        url: meta.url || null,
        content: meta.content || null,
        comments: meta.comments || null,
        jsonLdRaw: meta.jsonLdRaw || null,
        markdown: meta.rawContent || null,
        updatedAt: new Date()
      };

      await collection.updateOne(
        { id: id },
        { $set: doc },
        { upsert: true }
      );

    } else if (site === 'gpters' || site === 'gpters_newsletter') {
      const collection = await mongo.getCollection(`silver/${site}.contents`);
      const doc: Record<string, any> = {
        id: id,
        title: meta.title || 'Untitled',
        url: meta.url || null,
        author: meta.author || null,
        shortContent: meta.shortContent || null,
        publishedAt: meta.publishedAt || null,
        reactionsCount: meta.reactionsCount || 0,
        repliesCount: meta.repliesCount || 0,
        markdown: meta.rawContent || null,
        updatedAt: new Date()
      };
      if (meta.spaceId) doc.spaceId = meta.spaceId;
      if (meta.spaceName) doc.spaceName = meta.spaceName;
      if (meta.spaceSlug) doc.spaceSlug = meta.spaceSlug;

      await collection.updateOne(
        { id: id },
        { $set: doc },
        { upsert: true }
      );

    } else if (site === 'pytorch_kr') {
      const collection = await mongo.getCollection('silver/pytorch_kr.contents');
      const doc = {
        id: id,
        title: meta.title || 'Untitled',
        url: meta.url || null,
        publishedAt: meta.publishedAt || null,
        content: meta.content || null,
        markdown: meta.rawContent || null,
        updatedAt: new Date()
      };

      await collection.updateOne(
        { id: id },
        { $set: doc },
        { upsert: true }
      );
    }
  }
}
