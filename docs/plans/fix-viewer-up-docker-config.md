# Plan: Viewer Up Docker Config 수정

`make viewer-up` 실행 시 `no such service: traefik` 오류가 발생하는 문제를 수정하기 위해 docker compose 다중 파일 머지 설정을 정리하는 계획서입니다.

## User Review Required
> [!IMPORTANT]
> - `apps/viewer/Makefile`의 `COMPOSE` 명령에서 `-f compose.yml`을 중복하여 가져오는 부분을 제거하고, 루트의 `compose.yml`만 참조하게 함으로써 루트 `compose.yml` 내 `include` 블록이 완벽하게 결합되어 동작하도록 합니다.

## Proposed Changes

### 1. Viewer App Configuration
- **`[MODIFY]`** `apps/viewer/Makefile`: `COMPOSE` 변수 정의 부분 변경
  ```makefile
  COMPOSE ?= docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml
  ```

---

## Verification Plan

### Manual Verification
- `make viewer-up` 명령을 통해 정상적으로 `viewer-fe`, `viewer-api`, `viewer-mcp` 서비스가 작동하고 `traefik`을 찾지 못하는 오류가 사라졌는지 검증합니다.
