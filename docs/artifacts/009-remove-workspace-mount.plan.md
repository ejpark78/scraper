# Plan: remove-workspace-mount

사이트별 스크립트 실행 Makefile에서 호스트 디렉토리를 런타임에 덮어씌워 파일 시스템의 불완전성을 초래하던 `$(WORKSPACE_MOUNT)` 수동 마운트 설정을 전면 배제하고, 이미 빌드된 도커 이미지 내부의 온전한 형상 기준으로 안정적으로 가동(Bugfix)시키는 계획입니다.

## User Review Required
> [!IMPORTANT]
> - 모든 사이트 스크립트 실행 Makefile(`scripts/sites/*.mk`)의 `docker compose run` 구문에서 `$(WORKSPACE_MOUNT)` 옵션이 전면 삭제됩니다.
> - 이미지 빌드 시 복사된 `tsconfig.json` 및 `packages/` 등 루트 자원을 온전히 활용하여 컴파일러 경로 탐색의 안전성을 회복합니다.

## Proposed Changes

### 1. Remove Volume Mount Bindings from CLI Actions
- **`[MODIFY]`** `scripts/sites/` 하위의 모든 `.mk` 파일 (9개):
  - `$(WORKSPACE_MOUNT)` 매개변수를 전면 삭제하여 이미지 내부 경로가 덮어씌워 지지 않도록 차단
- **`[MODIFY]`** `scripts/environments.mk`:
  - `WORKSPACE_MOUNT` 변수 정의부 제거

---

## Verification Plan

### Manual Verification
- 사이트 리스트 덤프 테스트:
  - `make list` 실행하여 `gpters_news` 등이 `TS5083` 오류 없이 도커 이미지 내부 상태로 안전하게 가동 및 완수되는지 검증합니다.
