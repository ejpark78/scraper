# 📝 [Plan] 컨버터 리팩터링 및 Graceful Shutdown 도입 계획서

본 계획서는 중복된 컨버터 유틸리티 로직을 `BaseConverter`로 공통화하고, 워커 프로세스의 안정적인 자원 회수(Graceful Shutdown)를 구축하며, 타입 안전성 규정을 준수하기 위한 세부 계획을 명시합니다. (유저 요청에 따라 데이터베이스 mongo.ts 중복은 본 개선 대상에서 제외/보류합니다.)

---

## 📅 1. 작업 범위 및 대상 파일

1. **`BaseConverter` 추상 클래스 신설 및 적용**
   - 대상: [apps/crawler/src/core/BaseConverter.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/core/BaseConverter.ts) (신규 파일)
   - 수정 대상 사이트 컨버터 (상속 처리 및 중복 코드 제거):
     - `apps/crawler/src/sites/aicasebook/Converter.ts`
     - `apps/crawler/src/sites/dailydoseofds/Converter.ts`
     - `apps/crawler/src/sites/geeknews/Converter.ts`
     - `apps/crawler/src/sites/gpters/Converter.ts`
     - `apps/crawler/src/sites/linkedin/company/Converter.ts`
     - `apps/crawler/src/sites/linkedin/jobs/Converter.ts`
     - `apps/crawler/src/sites/maily/josh/Converter.ts`
     - `apps/crawler/src/sites/pytorch_kr/Converter.ts`
     - `apps/crawler/src/sites/uppity/Converter.ts`
     - `apps/crawler/src/sites/yozm/Converter.ts`

2. **워커 Graceful Shutdown 처리기 등록**
   - 대상:
     - [apps/crawler/src/workers/ConverterWorker.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/workers/ConverterWorker.ts)
     - [apps/crawler/src/workers/ScraperWorker.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/workers/ScraperWorker.ts)
   - 작업: `SIGINT`, `SIGTERM` 이벤트 캡처 루틴 구성 및 DB/Redis 클라이언트 명시적 close 호출.

3. **Strict Typing 준수 (`any` 제거)**
   - 대상: [apps/crawler/src/workers/ConverterWorker.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/workers/ConverterWorker.ts), [apps/crawler/src/database/mongo.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/database/mongo.ts)
   - 작업: `(converter as any)` 우회 호출을 인터페이스 검사 및 안전한 타입 가드 방식으로 대체하고 `catch (err: any)`의 `any` 타입을 정형화.

---

## 🛠️ 2. 상세 구현 설계

### A. `BaseConverter.ts` 신규 구현
[IConverter.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/core/IConverter.ts) 구조에 맞춰 다음 설계를 적용합니다.

```typescript
import { IConverter, IFileSaver } from './IConverter';
import * as prettier from 'prettier';
import * as fs from 'fs';
import * as path from 'path';

export abstract class BaseConverter<T> implements IConverter<T>, IFileSaver {
  public abstract convertHtmlToMarkdown(htmlContent: string, id: string, url: string): Promise<T>;

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
    const parentDir = path.dirname(outputPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, result, 'utf-8');
  }

  protected htmlToMarkdown(html: string): string {
    try {
      const TurndownService = require('turndown');
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
      });

      // 공통 태그 제거
      turndownService.remove(['script', 'style', 'nav', 'iframe', 'noscript', 'button', 'select', 'textarea', 'form']);
      
      let markdown = turndownService.turndown(html);
      markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');
      return markdown.trim();
    } catch {
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      return $.text().trim();
    }
  }
}
```

### B. Graceful Shutdown 핸들러 구성 (예시: ConverterWorker.ts)
```typescript
let isShuttingDown = false;
async function handleShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  Logger.info('[Converter] Gracefully shutting down worker...');
  try {
    await mongo.close();
    await redis.quit();
    Logger.info('[Converter] Connections closed. Exiting process.');
    process.exit(0);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    Logger.error(`[Converter] Error during shutdown: ${errorMsg}`);
    process.exit(1);
  }
}

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);
```

---

## 📈 3. 검증 계획

- **빌드 테스트**: 전체 Crawler 모듈의 컴파일 검증 (`npm run build` 또는 `tsc --noEmit`)
- **단위 테스트**: 기존 사이트별 Converter 단위 테스트를 실행하여 결과 포맷에 변화가 없는지 검증 (`npm run test` 혹은 대상 테스트 실행)

---

## ⚠️ 확인 요청 사항
- [BaseConverter](file:///Users/ejpark/workspace/scraper/apps/crawler/src/core/BaseConverter.ts) 도입에 따른 기존 컨버터의 상속 처리 시, 각 파일의 개별 의존성(예: 커스텀 Turndown 룰이나 특이한 prettify 규칙)이 있는지 변경 전에 꼼꼼히 확인하고 교체하겠습니다.
