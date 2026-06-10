import * as cheerio from 'cheerio';
import * as prettier from 'prettier';
import { IConverter } from '../../core/IConverter';

export interface YozmMeta {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  category: string | null;
  author: string | null;
  content: string;
  rawContent: string;
}

export class YozmConverter implements IConverter<YozmMeta> {

  public convertHtmlToMarkdown(htmlContent: string, id: string, url: string): YozmMeta {
    const $ = cheerio.load(htmlContent);

    const canonical = $('link[rel="canonical"]').attr('href');
    const finalUrl = canonical || url;

    const ogTitle = $('meta[property="og:title"]').attr('content');
    const titleTag = $('title').text().trim();
    const title = (ogTitle || titleTag || 'Unknown Title').replace(/\s*\|\s*요즘IT$/, '');

    let publishedAt: string | null = null;
    const jsonLdScript = $('script[type="application/ld+json"]').first().html();
    if (jsonLdScript) {
      try {
        const parsed = JSON.parse(jsonLdScript);
        if (parsed.datePublished) {
          publishedAt = parsed.datePublished;
        }
      } catch {
        // ignore parse errors
      }
    }

    let category: string | null = null;
    const categoryLink = $('a[data-testid="contentsItem-category-link"]').first();
    if (categoryLink.length) {
      category = categoryLink.text().trim();
    } else {
      const breadcrumbLinks = $('script[type="application/ld+json"]').last().html();
      if (breadcrumbLinks) {
        try {
          const parsed = JSON.parse(breadcrumbLinks);
          if (parsed.itemListElement && parsed.itemListElement.length >= 3) {
            category = parsed.itemListElement[2].name || null;
          }
        } catch {
          // ignore
        }
      }
    }

    let author: string | null = null;
    if (jsonLdScript) {
      try {
        const parsed = JSON.parse(jsonLdScript);
        if (parsed.author) {
          author = parsed.author.name || null;
        }
      } catch {
        // ignore
      }
    }
    if (!author) {
      const authorEl = $('a[href*="/magazine/@"], a[href*="/magazine/@"]').first();
      if (authorEl.length) {
        author = authorEl.text().trim() || null;
      }
    }

    const articleSection = $('#article-detail-wrapper, #article-detail-start').first().parent();
    let contentHtml = '';
    if (articleSection.length) {
      contentHtml = articleSection.html() || '';
    } else {
      contentHtml = $('section[id*="article-detail"]').first().html() || '';
    }

    const contentMarkdown = this.htmlToMarkdown(contentHtml);

    let markdown = `# ${title}\n\n`;
    if (category) {
      markdown += `* **카테고리:** ${category}\n`;
    }
    if (publishedAt) {
      markdown += `* **발행일:** ${publishedAt}\n`;
    }
    if (author) {
      markdown += `* **작가:** ${author}\n`;
    }
    markdown += `* **원본 링크:** [바로가기](${finalUrl})\n\n`;
    markdown += `---\n\n${contentMarkdown}\n`;

    return {
      id,
      title,
      url: finalUrl,
      publishedAt,
      category,
      author,
      content: contentMarkdown,
      rawContent: markdown,
    };
  }

  private htmlToMarkdown(html: string): string {
    try {
      const TurndownService = require('turndown');
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
      });
      turndownService.remove('script');
      turndownService.remove('style');
      turndownService.remove('nav');
      turndownService.remove('iframe');
      turndownService.remove('noscript');
      turndownService.remove('button');
      turndownService.remove('select');
      turndownService.remove('textarea');
      turndownService.remove('form');
      return turndownService.turndown(html).trim();
    } catch {
      const $ = cheerio.load(html);
      return $.text().replace(/\s+/g, ' ').trim();
    }
  }

  public async prettify(rawText: string): Promise<string> {
    const formatted = await prettier.format(rawText, {
      parser: 'markdown',
      proseWrap: 'preserve',
      tabWidth: 2,
      printWidth: 100,
    });
    return formatted.trim() + '\n';
  }

  public async prettifyAndSave(rawText: string, outputPath: string): Promise<void> {
    const result = await this.prettify(rawText);
    const fs = require('fs');
    const path = require('path');
    const parentDir = path.dirname(outputPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, result, 'utf-8');
  }
}
