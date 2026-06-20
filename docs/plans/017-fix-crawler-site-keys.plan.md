# Plan: 크롤러 사이트 키 불일치 오류 수정

`make list` 및 기타 사이트별 명령어(`refresh-urls`, `refresh-silver`, `diagnose` 등)를 실행할 때 특정 사이트 키(예: `dailydoseofds`, `linkedin`) 불일치로 인해 발생하는 문제를 근본적으로 해결하기 위한 계획입니다.

## User Review Required
> [!IMPORTANT]
> - `SiteRegistry.ts` 내의 `getSite()` 탐색 로직에서 별칭(Alias) 처리를 도입하여, `dailydoseofds` 인입 시 `dailydose_ds` 설정을 매핑해 주도록 합니다.
> - `cli-list.ts` 내부의 `pathMap`을 수정하여 `dailydoseofds`와 `linkedin`을 정식 키로 연동합니다.

## Proposed Changes

### 1. Core Registry
- **`[MODIFY]`** `apps/crawler/src/core/SiteRegistry.ts`: 
  - `getSite()` 함수에서 `dailydoseofds`를 `dailydose_ds`로 노멀라이즈 처리합니다.

### 2. Crawler CLI
- **`[MODIFY]`** `apps/crawler/src/cli-list.ts`: 
  - `pathMap`에서 `dailydose_ds` 키를 `dailydoseofds`로 변경합니다.
  - `pathMap`에서 `linkedin_jobs` 키를 `linkedin`으로 변경합니다.

---

## Verification Plan

### Automated Tests
- 없음

### Manual Verification
- `make list` 명령을 전체적으로 수행해봅니다.
- `make ddds-list` 및 `make li-list` 등을 개별적으로 수행해 보며 정상적으로 인식하고 동작하는지 검증합니다.
