# Code Review: GPTers 사이트 키 불일치 오류 수정

이 문서는 `apps/crawler/src/cli-list.ts`의 사이트 키 매핑 수정에 관한 코드 리뷰를 다룹니다.

## 1. 변경 요약
- `apps/crawler/src/cli-list.ts` 내부의 `pathMap` 및 관련 조건식에서 `gpters_news`로 기재되어 있어, Makefile이나 외부 package.json 등에서 `gpters` 키로 CLI를 직접 호출할 때 `Unknown site key` 에러가 발생하던 문제를 해결했습니다.
- `gpters_news`를 `gpters`로 수정하여 타 사이트 설정(`gpters/news/site.config.ts` 등)의 key명과 일치시켰습니다.

## 2. 타입 안전성 검토
- `pathMap`은 `Record<string, string>` 형태이므로 키 이름 수정 시 TypeScript 컴파일 에러가 발생하지 않습니다.
- 63라인의 조건문도 문자열 비교 조건식(`siteKey === 'gpters'`)으로 정상 교체되어 안전합니다.

## 3. 예외 처리 검토
- `cli-list.ts` 내에서 유효하지 않은 `siteKey`가 들어오면 기존과 동일하게 `Unknown site key: ${siteKey}` 에러 메시지를 출력하고 `process.exit(1)` 처리하므로, 예외 흐름은 안전하게 유지됩니다.
