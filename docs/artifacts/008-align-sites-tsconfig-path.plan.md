# Plan: align-sites-tsconfig-path

사이트별 스크립트 실행 Makefile에서 중복 선언되어 환경 변환 오류(Bugfix)를 유발하던 CLI 인자 `--project /app/tsconfig.json`을 일괄 제거하고, 공통 환경변수 `TS_NODE_PROJECT`로 단일화하여 동작의 안전성을 높이는 계획입니다.

## User Review Required
> [!IMPORTANT]
> - 모든 사이트 스크립트 실행 Makefile(`scripts/sites/*.mk`)의 `ts-node` 호출부에서 `--project` 매개변수가 전면 제거됩니다.
> - `environments.mk`에 지정된 환경변수 `-e TS_NODE_PROJECT=/app/tsconfig.json`을 통해 컴파일러의 경로 탐색이 안전하게 일원화됩니다.

## Proposed Changes

### 1. Site Makefiles CLI Refactoring
- **`[MODIFY]`** `scripts/sites/` 하위의 모든 `.mk` 파일 (9개):
  - `npx ts-node --project /app/tsconfig.json`을 `npx ts-node`로 일괄 축소 정비

---

## Verification Plan

### Manual Verification
- 사이트 리스트 덤프 테스트:
  - `make list` 실행하여 `gpters_news` 등이 TypeScript 컴파일 오류 없이 정상적으로 실행되는지 검증합니다.
