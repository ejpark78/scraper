import * as prettier from 'prettier';
import { IConverter } from '../../core/IConverter';

export interface GptersMeta {
    id: string;
    title: string;
    url: string;
    author: string | null;
    shortContent: string | null;
    publishedAt: string | null;
    reactionsCount: number;
    repliesCount: number;
    rawContent: string; // The markdown representation
    spaceId: string | null;
    spaceName: string | null;
    spaceSlug: string | null;
}

export class GptersConverter implements IConverter<GptersMeta> {
    
    public convertHtmlToMarkdown(htmlOrJsonContent: string, id: string, url: string): GptersMeta {
        let post: any = {};
        try {
            post = JSON.parse(htmlOrJsonContent);
        } catch (e) {
            post = { title: 'No Title', shortContent: htmlOrJsonContent };
        }

        const title = post.title || 'No Title';
        const author = post.author?.name || post.createdBy?.member?.name || 'Unknown';
        // fields.content has the full HTML body; shortContent is truncated
        const fieldsMap: Record<string, string> = {};
        if (Array.isArray(post.fields)) {
            for (const f of post.fields) {
                fieldsMap[f.key] = f.value;
            }
        }
        const longContent = fieldsMap.content || post.shortContent || '';
        const publishedAt = post.createdAt || null;
        const reactionsCount = post.reactionsCount || 0;
        const repliesCount = post.repliesCount || 0;
        const finalUrl = url || `https://www.gpters.org/news/post/${post.slug}-${id}`;
        const spaceId = post.space?.id || null;
        const spaceName = post.space?.name || null;
        const spaceSlug = post.space?.slug || null;

        // Create a Markdown output
        let markdown = `# 💡 [GPTERS] ${title}\n\n`;
        markdown += `* **작성자:** ${author}\n`;
        if (spaceName) markdown += `* **스페이스:** ${spaceName}\n`;
        markdown += `* **작성일:** ${publishedAt || '정보 없음'}\n`;
        markdown += `* **리액션:** 👍 ${reactionsCount} | 💬 ${repliesCount}\n`;
        markdown += `* **원본 링크:** [바로가기](${finalUrl})\n\n`;
        markdown += `## 📝 내용\n\n${longContent}\n`;

        return {
            id,
            title,
            url: finalUrl,
            author,
            shortContent: longContent,
            publishedAt,
            reactionsCount,
            repliesCount,
            rawContent: markdown,
            spaceId,
            spaceName,
            spaceSlug
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
