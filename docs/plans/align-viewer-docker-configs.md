# Plan: align-viewer-docker-configs

`apps/viewer/docker/` 하위의 빌드 컨텍스트를 `apps/crawler/`와 동일한 스타일로 모듈 루트(`..`) 기준의 일관된 상대 경로 구조로 정렬하고, `apps/viewer`가 `src/` 구조로 개편 및 `frontend`가 `src/frontend`로 이동함에 따른 소스 및 실행 파일 참조 경로를 일괄 정형화하는 계획입니다.

## User Review Required
> [!IMPORTANT]
> - `viewer-fe` 서비스의 빌드 컨텍스트가 프로젝트 루트 전체에서 `apps/viewer` 모듈 루트로 단축 변경됩니다.
> - `frontend` 디렉토리가 `src/frontend`로 이동함에 따라 모든 Dockerfile 내의 소스 복사 경로 및 빌드 스크립트가 이에 맞춰 수정됩니다.
> - `server.ts`와 `mcp-entry.ts`가 각각 `src/api/server.ts`, `src/mcp/mcp-entry.ts`로 이동함에 따라 `package.json` 및 `compose.yml`의 커맨드가 갱신됩니다.

## Proposed Changes

### 1. Package Configuration
- **`[MODIFY]`** `apps/viewer/package.json`:
  - `main`, `scripts.start`, `scripts.mcp` 경로를 각각 `src/api/server.ts`, `src/mcp/mcp-entry.ts`로 변경

### 2. Docker Compose Configuration
- **`[MODIFY]`** `apps/viewer/docker/compose.yml`:
  - `viewer-fe` 서비스의 빌드 경로 수정:
    - `context: ../../../` ➡️ `context: ..`
    - `dockerfile: apps/viewer/docker/fe/Dockerfile` ➡️ `dockerfile: docker/fe/Dockerfile`
  - `viewer-api` 및 `viewer-mcp` 서비스의 `command` 인자를 각각 `src/api/server.ts`, `src/mcp/mcp-entry.ts`로 변경

### 3. Dockerfiles
- **`[MODIFY]`** `apps/viewer/docker/fe/Dockerfile`:
  - `frontend` 경로를 `src/frontend`로 변경하고 `--prefix` 옵션 경로 수정
- **`[MODIFY]`** `apps/viewer/docker/api/Dockerfile`:
  - `frontend` 경로를 `src/frontend`로 수정하고 CMD 지시자를 `src/api/server.ts`로 변경
- **`[MODIFY]`** `apps/viewer/docker/mcp/Dockerfile`:
  - `frontend` 경로를 `src/frontend`로 수정하고 CMD 지시자를 `src/mcp/mcp-entry.ts`로 변경

---

## Verification Plan

### Manual Verification
- docker compose config 검증:
  - `docker compose --profile viewer config` 실행하여 빌드 컨텍스트 및 도커파일 매핑 무결성 검증
- docker compose build 검증:
  - `docker compose --profile viewer build` 빌드를 수행하여 프론트엔드 및 백엔드 이미지가 오류 없이 컴파일 및 레이어 생성되는지 검증
