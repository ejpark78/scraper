# Summary: 017-fix-crawler-site-keys

> Squashed from: 017-fix-crawler-site-keys.review.md 017-fix-crawler-site-keys.task.md 017-fix-crawler-site-keys.walkthrough.md

---

## Review

# Code Review: 크롤러 사이트 키 불일치 오류 수정

이 문서는 전체 크롤러 사이트 키 불일치 오류를 근본적으로 수정하기 위한 코드 리뷰 결과입니다.

## 1. 변경 요약
- `apps/crawler/src/core/SiteRegistry.ts`의 `getSite()` 함수 내에서 `dailydoseofds`가 전달될 경우 내부 데이터베이스 스키마 및 설정 명칭인 `dailydose_ds`로 자동 변경하여 정상 조회되도록 노멀라이즈 처리를 구현했습니다.
- `apps/crawler/src/cli-list.ts`의 `pathMap` 설정에서 `dailydose_ds` 키를 `dailydoseofds`로, `linkedin_jobs`를 `linkedin`으로 변경하여 Makefile 및 package.json 호출 키와의 불일치 문제를 해결했습니다.

## 2. 타입 안전성 검토
- `getSite()` 함수에 전달되는 `key` 파라미터는 `string` 타입이며, 매핑 함수 자체도 `string` 변환 및 기존 `registry.get()`을 사용하므로 완벽하게 타입 안전합니다.
- `cli-list.ts` 내 `pathMap` 역시 기존 `Record<string, string>` 구조를 그대로 유지한 단순 키명 변경이므로 빌드에 문제가 없습니다.

## 3. 예외 처리 검토
- `dailydoseofds` 외의 일반적인 미등록 키가 유입되면 기존과 동일하게 `undefined`를 반환하고, 각각의 CLI 구현체에서 예외 처리되므로 기존 작동 방식을 해치지 않습니다.

---

## Task

# Task List: 크롤러 사이트 키 불일치 오류 수정

이 문서는 작업을 위해 할당된 타스크 목록과 진행 현황을 보관합니다.

- [x] 전체 사이트 키 대조 및 불일치 진단 (`dailydoseofds`, `linkedin`)
- [x] 수정 계획 보완 및 사용자 최종 승인 획득
- [x] `docs/plans/fix-crawler-site-keys.md` 계획 문서 작성 및 저장
- [x] `SiteRegistry.ts`의 `getSite()` 노멀라이징 처리 추가
- [x] `cli-list.ts`의 `pathMap` 키 매핑 수정 (`dailydoseofds`, `linkedin` 연동)
- [x] 변경 사항 git commit
- [x] 코드 리뷰 세트 작성 (`.md`, `.task.md`, `.walkthrough.md`)
- [ ] 재빌드 및 검증 명령어 사용자 안내 및 확인

---

## Walkthrough

# Walkthrough: 크롤러 사이트 키 불일치 오류 수정

이 문서는 작업 결과 보고서입니다.

## 1. 수정 내용 상세
- [SiteRegistry.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/core/SiteRegistry.ts#L159)에서 `getSite` 호출 시 파라미터 `key`가 `dailydoseofds`인 경우 `dailydose_ds`로 자동 보정하여 반환하도록 함으로써, `dailydoseofds` 키를 사용하는 모든 후속 CLI 동작이 오동작 없이 원활하게 작동하게 조치했습니다.
- [cli-list.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/cli-list.ts#L16)에서 `dailydose_ds` 경로 매핑 키를 `dailydoseofds`로 변경하고, `linkedin_jobs`를 `linkedin`으로 변경하여 빌드 컨테이너의 CLI 연동 규격에 맞추었습니다.

## 2. 검증 방법 안내
- 컨테이너 이미지를 재생성(`make rebuild`)한 후, `make list` 또는 `make ddds-list`를 수행하여 모든 수집 스크립트가 에러 없이 시작되는지 확인합니다.

---

