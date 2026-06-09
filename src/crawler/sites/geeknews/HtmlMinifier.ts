import * as cheerio from 'cheerio';
import * as prettier from 'prettier';

export class GeekNewsHtmlMinifier {
    /**
     * 🧹 GeekNews용 HTML 문서 용량을 최소화하고 필요한 데이터구조만 남김
     * - 필수적인 JSON-LD 스크립트 태그(댓글용)는 보존
     * - 불필요한 태그(svg, img, iframe, style, 일반 script, noscript, nav, header, footer) 제거
     * - 필수 속성 필터링 및 Prettier 포맷팅 수행
     */
    public static async minify(html: string): Promise<string> {
        try {
            const $ = cheerio.load(html);

            // 일반 script 제거하되, application/ld+json 메타데이터 스크립트는 남겨둠
            $('script:not([type="application/ld+json"])').remove();
            
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
                'rel',
                'type' // type="application/ld+json" 등의 스크립트 타입 보존을 위해 추가
            ]);

            $('*').each((_, el) => {
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
