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

  private findNewsLd($: cheerio.CheerioAPI): Record<string, any> | null {
    let result: Record<string, any> | null = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      const text = $(el).html();
      if (!text) return;
      try {
        const parsed = JSON.parse(text);
        if (parsed['@type'] === 'NewsArticle') {
          result = parsed;
        }
      } catch {}
    });
    return result;
  }

  public async convertHtmlToMarkdown(htmlContent: string, id: string, url: string): Promise<YozmMeta> {
    const $ = cheerio.load(htmlContent);
 
    const canonical = $('link[rel="canonical"]').attr('href');
    const finalUrl = canonical || url;
 
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const titleTag = $('title').text().trim();
    const title = (ogTitle || titleTag || 'Unknown Title').replace(/\s*\|\s*요즘IT$/, '');
 
    const newsLd = this.findNewsLd($);
 
    let publishedAt: string | null = null;
    if (newsLd?.datePublished) {
      publishedAt = newsLd.datePublished;
    }
 
    let category: string | null = null;
    if (newsLd?.articleSection) {
      category = newsLd.articleSection;
    }
    if (!category) {
      const categoryLink = $('a[data-testid="contentsItem-category-link"]').first();
      if (categoryLink.length) {
        category = categoryLink.text().trim();
      }
    }
 
    let author: string | null = null;
    if (newsLd?.author?.name) {
      author = newsLd.author.name;
    }
    if (author === '요즘IT') {
      const authorEl = $('a[href*="/magazine/@"], a[href*="/magazine/@"]').first();
      if (authorEl.length) {
        const realAuthor = authorEl.text().trim();
        if (realAuthor) author = realAuthor;
      }
    }
 
    let contentMarkdown: string = '';
    
    // 요즘IT는 Next.js 스트리밍 방식을 사용하여 본문이 main[data-id="detail-contents"] 내부에 고정되어 있지 않고,
    // S:3 등 동적으로 생성된 스트리밍 chunk div 내부에 렌더링될 수 있습니다.
    // 본문 단락(.typo-contents16)의 부모 컨테이너를 찾아 본문 HTML 영역을 확보합니다.
    let contentContainer = $('main[data-id="detail-contents"]');
    const typoParagraphs = $('.typo-contents16');
    if (typoParagraphs.length > 0) {
      const parent = typoParagraphs.first().parent();
      if (parent.length > 0) {
        contentContainer = parent;
      }
    }

    const detailHtml = contentContainer.html();
    if (detailHtml && detailHtml.trim().length > 50) {
      contentMarkdown = this.htmlToMarkdown(detailHtml);
    }
 
    if (!contentMarkdown || contentMarkdown === '(content extraction failed)') {
      let bodyText = '';
      if (newsLd?.articleBody) {
        bodyText = newsLd.articleBody
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
      contentMarkdown = bodyText || '(content extraction failed)';
    }
 
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
      
      let markdown = turndownService.turndown(html);
      
      // HTML 태그 기반의 강제 줄바꿈 보정 (정규식 활용)
      // P, DIV 등의 블록 요소가 변환된 후 붙어버리는 경우를 대비해 줄바꿈 강화
      markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      return markdown.trim();
    } catch {
      const $ = cheerio.load(html);
      return $.text().trim();
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
