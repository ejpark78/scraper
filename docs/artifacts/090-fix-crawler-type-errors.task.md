# 090-fix-crawler-type-errors.task.md

이 문서는 `apps/crawler` 내의 TypeScript 컴파일 타입 에러 수정 현황을 관리하는 할 일 목록입니다.

## 🎯 작업 목표
- `npm run type-check` 통합 실행 시 발생하는 모든 TypeScript 컴파일 오류 해결
- `npm run lint` 수행 시 ESLint 및 Ruff에서 에러 0개 달성

## 📝 할 일 목록 (Todo List)

### 1. 존재하지 않는 경로 및 모듈 임포트 버그 수정
- [ ] `apps/crawler/src/scripts/diff_debug.ts` 상대 경로 해결
- [ ] `apps/crawler/src/sites/aicasebook/Contents.ts` 이미지 다운로더 유틸 경로 매핑
- [ ] `apps/crawler/src/sites/geeknews/Contents.ts` 상대 경로 및 타입 매핑 수정
- [ ] `apps/crawler/src/sites/gpters/news/Contents.ts` 이미지 다운로더 유틸 경로 매핑
- [ ] `apps/crawler/src/sites/gpters/newsletter/Contents.ts` 이미지 다운로더 유틸 경로 매핑
- [ ] `apps/crawler/src/sites/linkedin/company/Contents.ts` BasePipeline 경로 매핑
- [ ] `apps/crawler/src/sites/linkedin/jobs/Contents.ts` BasePipeline 경로 매핑
- [ ] `apps/crawler/src/sites/pytorch_kr/Contents.ts` pool 및 유틸 경로 매핑
- [ ] `apps/crawler/src/tools/browser/open.ts` AppConfig 경로 매핑

### 2. `unknown` 및 타입 불일치 객체 타입 보강
- [ ] `apps/crawler/src/workers/ConverterWorker.ts` DB 조회 결과의 `unknown` 타입을 적절한 인터페이스 타입으로 단언
- [ ] `apps/crawler/src/scripts/extract_article.ts` `unknown` 객체 타입 속성 접근 에러 우회
- [ ] `apps/crawler/src/sites/gpters/newsletter/site.config.ts` 타입 캐스팅 수정
- [ ] `apps/crawler/src/sites/linkedin/jobs/Converter.ts` 유틸 및 타입 전역 매핑/임포트 추가
- [ ] `apps/crawler/src/sites/linkedin/jobs/List.ts` Config 타입 호환성 수정
- [ ] `apps/crawler/src/sites/uppity/Converter.ts` 누락된 cleanContent 프로퍼티 에러 해결
- [ ] `apps/crawler/tests/sites/linkedin/McpClient.test.ts` `unknown` 에러 우회
- [ ] `apps/crawler/tests/sites/linkedin/UrlManager.test.ts` Config 타입 호환성 수정
- [ ] `apps/crawler/tests/sites/pytorch_kr/Converter.test.ts` Date 형식 변수 타입 에러 해결

### 3. Cheerio V1 네임스페이스 매핑
- [ ] `apps/crawler/tests/sites/maily/josh/Converter.test.ts` `cheerio.Element` 타입 에러 해결
- [ ] `apps/crawler/tests/sites/yozm/Converter.test.ts` `cheerio.Element` 타입 에러 해결

### 4. 최종 통합 검증
- [ ] `npm run lint` 최종 무오류 검증
- [ ] `npm run type-check` 최종 무오류 검증
