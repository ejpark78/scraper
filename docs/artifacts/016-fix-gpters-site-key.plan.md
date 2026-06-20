# Plan: GPTers 사이트 키 불일치 오류 수정

`make list` 실행 시 `gpters` 사이트 키를 인식하지 못하는 오류를 해결하기 위한 코드 수정 및 검증 계획입니다.

## User Review Required
> [!IMPORTANT]
> - `apps/crawler/src/cli-list.ts` 내부의 `gpters_news` 키 명칭을 `gpters`로 일괄 변경합니다.
> - 기존 Makefile 및 package.json에서 사용하던 `gpters` 키와 호환되도록 하여 `make list` 명령이 정상 작동하도록 합니다.

## Proposed Changes

### 1. Crawler CLI 모듈
- **`[MODIFY]`** `apps/crawler/src/cli-list.ts`: 
  - `pathMap` 내의 `gpters_news` 키를 `gpters`로 수정합니다.
  - 63라인의 조건문 `siteKey === 'gpters_news'`를 `siteKey === 'gpters'`로 수정합니다.

---

## Verification Plan

### Automated Tests
- 없음 (CLI 및 빌드 동작 여부 수동 확인)

### Manual Verification
- `make list` 명령을 실행하여 `gpters` 수집 과정이 정상적으로 실행되는지 확인합니다.
- 상세 디버그: `docker compose -p scraper run --rm worker npx ts-node src/cli-list.ts --site gpters --page 1` 명령을 수동으로 수행하여 실행 상태를 검증합니다.
