# Summary: 016-fix-gpters-site-key

> Squashed from: 016-fix-gpters-site-key.review.md 016-fix-gpters-site-key.task.md 016-fix-gpters-site-key.walkthrough.md

---

## Review

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

---

## Task

# Task List: GPTers 사이트 키 불일치 오류 수정

이 문서는 작업을 위해 할당된 타스크 목록과 진행 현황을 보관합니다.

- [x] 원인 분석 및 `cli-list.ts` 확인
- [x] 구현 계획 제안 및 사용자 승인 획득
- [x] `docs/plans/fix-gpters-site-key.md` 계획 문서 작성 및 저장
- [x] `apps/crawler/src/cli-list.ts` 코드 수정
  - `pathMap` 내 `gpters_news` -> `gpters` 변경
  - 조건문 내 `gpters_news` -> `gpters` 변경
- [x] 변경 사항 git commit
- [x] 코드 리뷰 세트 작성 (`.md`, `.task.md`, `.walkthrough.md`)
- [ ] 검증 명령어 사용자 안내 및 확인

---

## Walkthrough

# Walkthrough: GPTers 사이트 키 불일치 오류 수정

이 문서는 작업 결과 보고서입니다.

## 1. 수정 내용 상세
- [cli-list.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/cli-list.ts#L18)에서 `gpters_news`로 선언되어 있던 키를 `gpters`로 수정하여 `gpters/news/site.config.ts` 및 Makefile, `package.json`의 호출 설정과 통일했습니다.
- [cli-list.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/cli-list.ts#L63)의 수집 제한 처리 분기 조건문에서 `gpters_news` 키 대신 `gpters` 키를 식별하도록 변경했습니다.

## 2. 검증 방법 안내
- 사용자는 `make list` 또는 개별 `make gpt-list` 명령을 실행하여 오류 없이 수집이 정상 시작되는지 검증할 수 있습니다.

---

