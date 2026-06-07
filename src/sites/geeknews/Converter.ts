import * as cheerio from 'cheerio';
import * as prettier from 'prettier';
import { IConverter } from '../../core/IConverter';

export interface GeekNewsComment {
    commentId: string;
    author: string;
    content: string;
}

export interface GeekNewsMeta {
    id: string;
    title: string;
    url: string;
    content: string;
    comments: GeekNewsComment[];
    jsonLdRaw: string | null;
    rawContent: string; // The markdown representation
}

export class GeekNewsConverter implements IConverter<GeekNewsMeta> {
    
    public convertHtmlToMarkdown(htmlContent: string, id: string, url: string): GeekNewsMeta {
        const $ = cheerio.load(htmlContent);
        
        // 1. Extract title
        const title = $('title').text().replace(' | GeekNews', '').trim() || '정보 없음';
        
        // Extract external original link from the title anchor (.topictitle a)
        const topictitleA = $('.topictitle a');
        let externalUrl = topictitleA.attr('href')?.trim() || '';
        if (externalUrl) {
            if (!externalUrl.startsWith('http')) {
                externalUrl = `https://news.hada.io/${externalUrl.replace(/^\//, '')}`;
            }
        } else {
            externalUrl = url; // Fallback to GeekNews topic details URL
        }
        
        // 2. Extract JSON-LD and comments & content
        const comments: GeekNewsComment[] = [];
        let jsonLdRaw: string | null = null;
        let content = '';
        
        try {
            const jsonLdScript = $('script[type="application/ld+json"]');
            if (jsonLdScript.length > 0) {
                jsonLdRaw = jsonLdScript.html();
                if (jsonLdRaw) {
                    const data = JSON.parse(jsonLdRaw);
                    // Prioritize JSON-LD description text
                    if (data.text) {
                        content = data.text.trim();
                    } else if (data.articleBody) {
                        content = data.articleBody.trim();
                    } else if (data.description) {
                        content = data.description.trim();
                    }
                    
                    let commentDataList = data.comment || [];
                    if (commentDataList && !Array.isArray(commentDataList)) {
                        commentDataList = [commentDataList];
                    }
                    
                    const processJsonLdComment = (commentData: any) => {
                        if (!commentData || typeof commentData !== 'object') return;
                        const text = commentData.text;
                        if (text) {
                            const commentUrl = commentData.url || '';
                            comments.push({
                                commentId: commentUrl.includes('id=') ? commentUrl.split('id=').pop()!.split('&')[0] : '',
                                author: commentData.author?.name || 'Unknown',
                                content: text
                            });
                        }
                        let children = commentData.comment || [];
                        if (children && !Array.isArray(children)) {
                            children = [children];
                        }
                        for (const child of children) {
                            processJsonLdComment(child);
                        }
                    };
                    
                    for (const commentData of commentDataList) {
                        processJsonLdComment(commentData);
                    }
                }
            }
        } catch (e: any) {
            console.error(`⚠️ JSON-LD 파싱 중 에러 발생: ${e.message}`);
        }
        
        // 3. Fallback to HTML description/content if JSON-LD content is empty
        if (!content) {
            const topicDescEl = $('.topicdesc');
            if (topicDescEl.length > 0) {
                const html = topicDescEl.html() || '';
                try {
                    const TurndownService = require('turndown');
                    const turndownService = new TurndownService({
                        headingStyle: 'atx',
                        hr: '---',
                        bullet: '-',
                        codeBlockStyle: 'fenced'
                    });
                    content = turndownService.turndown(html).trim();
                } catch (err) {
                    content = topicDescEl.text().trim();
                }
            }
        }
        
        // 4. Fallback to HTML comment parsing if no comments found from JSON-LD
        if (comments.length === 0) {
            $('.comment_row').each((_, el) => {
                const row = $(el);
                const authorEl = row.find('.commentinfo a[href^="/@"]');
                const contentEl = row.find('.comment_contents');
                if (contentEl.length > 0) {
                    comments.push({
                        commentId: row.attr('id') || '',
                        author: authorEl.text().trim() || 'Unknown',
                        content: contentEl.text().replace(/\n/g, ' ').trim()
                    });
                }
            });
        }
        
        // 4. Generate Markdown
        let markdown = `# 📰 ${title}\n\n`;
        markdown += `* **기사 링크:** [바로가기](${externalUrl})\n\n`;
        markdown += `## 📝 요약 설명\n${content}\n\n`;
        
        if (comments.length > 0) {
            markdown += `## 💬 댓글 및 토론 (${comments.length}개)\n\n`;
            for (const comment of comments) {
                markdown += `### 👤 ${comment.author}\n> ${comment.content}\n\n`;
            }
        }
        
        return {
            id,
            title,
            url: externalUrl,
            content,
            comments,
            jsonLdRaw,
            rawContent: markdown
        };
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
