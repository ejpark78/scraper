import * as cheerio from 'cheerio';
import * as prettier from 'prettier';

export class HtmlMinifier {
    /**
     * 🧹 HTML 문서 용량을 줄이고 가독성을 높이기 위해 
     * 불필요한 태그 제거, 필수 속성 필터링 및 Prettier 포맷팅 수행
     */
    public static async minify(html: string): Promise<string> {
        try {
            const $ = cheerio.load(html);
            $('script').remove();
            $('style').remove();
            $('svg').remove();
            $('img').remove();
            $('iframe').remove();
            $('noscript').remove();
            $('link[rel="stylesheet"]').remove();
            $('link[type="text/css"]').remove();
            $('header').remove();
            $('footer').remove();
            $('nav').remove();
            
            // 허용할 최소 필수 HTML 속성 목록
            const allowedAttributes = new Set([
                'id',
                'class',
                'href',
                'name',
                'content',
                'property',
                'componentkey',
                'rel',
                'aria-label',
                'data-tracking-control-name'
            ]);

            $('*').each((i, el) => {
                const $el = $(el);
                const attribs = $el.attr();
                if (attribs) {
                    for (const attr in attribs) {
                        if (!allowedAttributes.has(attr.toLowerCase())) {
                            $el.removeAttr(attr);
                        }
                    }
                }
            });
            
            const rawCleaned = $.html().replace(/<!--[\s\S]*?-->/g, '');

            // Prettier를 이용해 가독성 높게 포맷팅 수행
            const prettified = await prettier.format(rawCleaned, {
                parser: 'html',
                printWidth: 120,
                tabWidth: 2
            });

            return prettified;
        } catch (e) {
            // 예외 발생 시 원본 반환
            return html;
        }
    }
}
