import { PostgresDatabase } from './database/postgres';
import { UrlUtils, NamingUtils } from './utils';

export class TargetLoader {
  /**
   * 정제된 구조화 데이터를 PostgreSQL Silver Database의 타겟 테이블에 적재합니다.
   */
  public static async load(site: string, id: string, meta: any): Promise<void> {
    const pg = PostgresDatabase.getInstance();

    if (site === 'linkedin') {
      const query = `
        INSERT INTO jobs (job_id, title, company_name, company_id, description, location, geo, work_style, url, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (job_id) DO UPDATE SET
          title = EXCLUDED.title,
          company_name = EXCLUDED.company_name,
          company_id = EXCLUDED.company_id,
          description = EXCLUDED.description,
          location = EXCLUDED.location,
          geo = EXCLUDED.geo,
          work_style = EXCLUDED.work_style,
          url = EXCLUDED.url,
          updated_at = NOW();
      `;
      const stdLoc = UrlUtils.standardizeLocation(meta.rawLocation);
      const companyId = meta.company ? NamingUtils.generateSafeFileName(meta.company, '') : null;
      
      const values = [
        id,
        meta.jobTitle || 'Untitled',
        meta.company || null,
        companyId,
        meta.rawContent || null,
        meta.rawLocation || null,
        stdLoc || 'Unknown',
        '정보 없음',
        `https://www.linkedin.com/jobs/view/${id}`
      ];
      await pg.query(query, values);

    } else if (site === 'linkedin_company') {
      const query = `
        INSERT INTO companies (company_id, company_name, tagline, website, industry, company_size, description, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (company_id) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          tagline = EXCLUDED.tagline,
          website = EXCLUDED.website,
          industry = EXCLUDED.industry,
          company_size = EXCLUDED.company_size,
          description = EXCLUDED.description,
          updated_at = NOW();
      `;
      const values = [
        id,
        meta.companyName || 'Unknown Company',
        meta.tagline || null,
        meta.website || null,
        meta.industry || null,
        meta.companySize || null,
        meta.hqDescription || null
      ];
      await pg.query(query, values);

    } else if (site === 'geeknews') {
      const query = `
        INSERT INTO geeknews (id, title, url, content, comments, json_ld_raw, markdown, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          url = EXCLUDED.url,
          content = EXCLUDED.content,
          comments = EXCLUDED.comments,
          json_ld_raw = EXCLUDED.json_ld_raw,
          markdown = EXCLUDED.markdown,
          updated_at = NOW();
      `;
      const values = [
        id,
        meta.title || 'Untitled',
        meta.url || null,
        meta.content || null,
        meta.comments || null,
        meta.jsonLdRaw ? JSON.stringify(meta.jsonLdRaw) : null,
        meta.rawContent || null
      ];
      await pg.query(query, values);

    } else if (site === 'gpters') {
      const query = `
        INSERT INTO gpters (id, title, url, author, short_content, published_at, reactions_count, replies_count, markdown, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          url = EXCLUDED.url,
          author = EXCLUDED.author,
          short_content = EXCLUDED.short_content,
          published_at = EXCLUDED.published_at,
          reactions_count = EXCLUDED.reactions_count,
          replies_count = EXCLUDED.replies_count,
          markdown = EXCLUDED.markdown,
          updated_at = NOW();
      `;
      const values = [
        id,
        meta.title || 'Untitled',
        meta.url || null,
        meta.author || null,
        meta.shortContent || null,
        meta.publishedAt || null,
        meta.reactionsCount || 0,
        meta.repliesCount || 0,
        meta.rawContent || null
      ];
      await pg.query(query, values);

    } else if (site === 'pytorch_kr') {
      const query = `
        INSERT INTO pytorch_kr (id, title, url, published_at, content, markdown, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          url = EXCLUDED.url,
          published_at = EXCLUDED.published_at,
          content = EXCLUDED.content,
          markdown = EXCLUDED.markdown,
          updated_at = NOW();
      `;
      const values = [
        id,
        meta.title || 'Untitled',
        meta.url || null,
        meta.publishedAt || null,
        meta.content || null,
        meta.rawContent || null
      ];
      await pg.query(query, values);
    }
  }
}
