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
