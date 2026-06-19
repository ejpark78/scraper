/**
 * @module Converter
 * @description Core functionality or script runner for Converter.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies cheerio, prettier, IConverter, turndown, fs
 * @lastUpdated 2026-06-11
 */

import * as cheerio from 'cheerio';
import * as prettier from 'prettier';
import { IConverter } from '../../../core/IConverter';

import { MailyJoshMeta } from './site.config';

export class MailyJoshConverter implements IConverter<MailyJoshMeta> {

  public async convertHtmlToMarkdown(htmlContent: string, id: string, url: string): Promise<MailyJoshMeta> {
    const $ = cheerio.load(htmlContent);

    const canonical = $('link[rel="canonical"]').attr('href');
    const finalUrl = canonical || url;

    const ogTitle = $('meta[property="og:title"]').attr('content');
    const titleTag = $('title').text().trim();
    const title = ogTitle || titleTag || 'Unknown Title';

    const category = $('h2 a[href*="/c/"]').first().text().trim() || null;

    let publishedAt: string | null = null;
    const pubDateMeta = $('meta[property="article:published_time"]').attr('content');
    if (pubDateMeta) {
      publishedAt = pubDateMeta;
    } else {
      const dateEl = $('span.text-slate-600').first();
      const dateText = dateEl.text().trim();
      const dateMatch = dateText.match(/(\d{4}\.\d{2}\.\d{2})/);
      if (dateMatch) {
        const parts = dateMatch[1].split('.');
        publishedAt = `${parts[0]}-${parts[1]}-${parts[2]}T00:00:00Z`;
      }
    }

    let viewCount: string | null = null;
    $('span.text-slate-600').each((_, el) => {
      const text = $(el).text().trim();
      if (text.includes('조회')) {
        viewCount = text.replace('조회', '').trim();
      }
    });

    const articleHtml = $('article.post-body-narrow').first().html() || '';
    const contentMarkdown = this.htmlToMarkdown(articleHtml);

    let markdown = `# ${title}\n\n`;
    if (category) {
      markdown += `* **카테고리:** ${category}\n`;
    }
    if (publishedAt) {
      markdown += `* **발행일:** ${publishedAt}\n`;
    }
    if (viewCount) {
      markdown += `* **조회수:** ${viewCount}\n`;
    }
    markdown += `* **원본 링크:** [바로가기](${finalUrl})\n\n`;
    markdown += `---\n\n${contentMarkdown}\n`;

    return {
      id,
      title,
      url: finalUrl,
      publishedAt,
      category,
      viewCount,
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
      return $.text().trim();
    }
  }

  public async prettify(rawText: string): Promise<string> {
    const formatted = await prettier.format(rawText, {
      parser: 'markdown',
      proseWrap: 'preserve',
      tabWidth: 2,
      printWidth: 100
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
