# 090-fix-crawler-type-errors.plan.md

이 계획서는 `apps/crawler` 내부에 누적되어 있던 TypeScript 컴파일 타입 에러들을 수정하고 정적 검증(`npm run type-check`) 프로세스를 완전히 통과시키는 것을 목표로 합니다.

## 1. 🔍 발견된 오류 분석 및 해결 전략

### A. 존재하지 않는 경로 / 잘못된 상대 경로 가져오기 문제
- **대상**: `src/scripts/diff_debug.ts`, `src/sites/aicasebook/Contents.ts`, `src/sites/geeknews/Contents.ts`, `src/sites/gpters/*/Contents.ts`, `src/sites/pytorch_kr/Contents.ts`, `src/sites/linkedin/*/Contents.ts`, `src/tools/browser/open.ts`
- **전략**: 
  - `diff_debug.ts`에서 `../crawler/...` 대신 `./src/...` 또는 올바른 로컬 상대 경로로 수정합니다.
  - 패키지 외부 유틸 및 core 경로가 `tsconfig.json` 내 `paths` 별칭(`@wiki/database`, `@wiki/config` 등)으로 설정되어 있으므로, 타입 참조 및 모듈 경로를 이에 맞추거나 실제 물리 파일 위치(`../../packages/...`)에 맞게 정정합니다.

### B. `unknown` 타입 객체 속성 참조 문제
- **대상**: `src/workers/ConverterWorker.ts`, `src/scripts/extract_article.ts`, `src/sites/gpters/newsletter/site.config.ts`, `tests/sites/linkedin/McpClient.test.ts`
- **전략**: 
  - `unknown` 타입에 직접 `.rawContent`, `.content`, `.title` 등을 조회하면 TS 에러가 납니다.
  - 대상 변수들을 구체적인 인터페이스/타입으로 단언(Type Assertion, 예: `as any` 혹은 구체적 타입 정의 적용)하거나, 타입 가드(Type Guard)를 도입하여 우회합니다.

### C. 외부 라이브러리 타입 및 네임스페이스 불일치
- **대상**: `tests/sites/maily/josh/Converter.test.ts`, `tests/sites/yozm/Converter.test.ts` 등에서의 Cheerio `Element` 참조 에러.
- **전략**:
  - Cheerio v1 패키지 구조상 `cheerio.Element` 대신 `import { Element } from 'domhandler'` 또는 `cheerio` 패키지에서 올바른 타입 명칭을 가져오도록 수정합니다.

---

## 2. 🛠️ 작업 파일 목록 (수정 범위)

1. **`apps/crawler/src/scripts/diff_debug.ts`**
2. **`apps/crawler/src/scripts/extract_article.ts`**
3. **`apps/crawler/src/workers/ConverterWorker.ts`**
4. **`apps/crawler/src/sites/aicasebook/Contents.ts`**
5. **`apps/crawler/src/sites/geeknews/Contents.ts`**
6. **`apps/crawler/src/sites/gpters/news/Contents.ts`**
7. **`apps/crawler/src/sites/gpters/newsletter/Contents.ts`**
8. **`apps/crawler/src/sites/gpters/newsletter/site.config.ts`**
9. **`apps/crawler/src/sites/linkedin/company/Contents.ts`**
10. **`apps/crawler/src/sites/linkedin/jobs/Contents.ts`**
11. **`apps/crawler/src/sites/linkedin/jobs/Converter.ts`**
12. **`apps/crawler/src/sites/linkedin/jobs/List.ts`**
13. **`apps/crawler/src/sites/pytorch_kr/Contents.ts`**
14. **`apps/crawler/src/sites/uppity/Converter.ts`**
15. **`apps/crawler/src/tools/browser/open.ts`**
16. **`apps/crawler/tests/sites/linkedin/McpClient.test.ts`**
17. **`apps/crawler/tests/sites/linkedin/UrlManager.test.ts`**
18. **`apps/crawler/tests/sites/maily/josh/Converter.test.ts`**
19. **`apps/crawler/tests/sites/pytorch_kr/Converter.test.ts`**
20. **`apps/crawler/tests/sites/yozm/Converter.test.ts`**

## 3. 🏁 검증 계획

- **통합 정적 분석 테스트**:
  - `npm run lint` 수행 시 ESLint 및 Ruff에서 에러 0개 달성 확인.
  - `npm run type-check` 수행 시 TypeScript 컴파일 에러 0개 통과 확인.
