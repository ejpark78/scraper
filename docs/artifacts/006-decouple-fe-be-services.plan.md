# Plan: decouple-fe-be-services

Vite 프론트엔드와 Express API 및 MCP 백엔드 서버를 완전히 물리적으로 디커플링(Decoupling)하여 백엔드 빌드 환경에서 불필요한 프론트엔드 빌드 종속성 및 정적 파일 호스팅을 걷어내고, 최근 `src/` 구조 이동으로 발생한 TypeScript 임포트 참조 오류(Bugfix)를 해결하는 계획입니다.

## User Review Required
> [!IMPORTANT]
> - `viewer-api` 및 `viewer-mcp` 서비스의 Dockerfile에서 프론트엔드 종속성 설치 및 빌드 과정이 전면 제거되어 빌드 효율이 향상됩니다.
> - `server.ts`에서 Express가 더 이상 `dist` 폴더를 정적 파일로 서빙하지 않습니다. (Traefik에서 이미 `viewer-fe` 서비스로 정적 페이지 트래픽을 처리하고 있으므로 기능에 문제가 없습니다.)
> - **[Bugfix]** `server.ts`, `mcp-entry.ts`, `mcp.ts` 의 임포트 경로를 재정렬하여 `src/` 이동 후 발생하던 `TSError` 컴파일 오류를 원천 해결합니다.

## Proposed Changes

### 1. Package & Source Import Path Restructuring (Bugfixes)
- **`[MODIFY]`** `apps/viewer/src/mcp/mcp-entry.ts`:
  - `MongoDatabase` 임포트 경로 변경 (`./database/mongo` ➡️ `../database/mongo`)
- **`[MODIFY]`** `apps/viewer/src/api/server.ts`:
  - `database/mongo`, `database/meili`, `config/AppConfig`, `SiteRegistry` 경로를 `../` 상위 디렉토리 기준으로 수정
- **`[MODIFY]`** `apps/viewer/src/mcp/mcp.ts`:
  - `database/meili`, `SiteRegistry` 경로를 `../` 상위 디렉토리 기준으로 수정

### 2. Dockerfiles
- **`[MODIFY]`** `apps/viewer/docker/api/Dockerfile`:
  - 프론트엔드 의존성 및 에셋 빌드 단계 제거
- **`[MODIFY]`** `apps/viewer/docker/mcp/Dockerfile`:
  - 프론트엔드 의존성 및 에셋 빌드 단계 제거

### 3. Docker Compose Configuration (Bugfix)
- **`[MODIFY]`** `apps/viewer/docker/compose.yml`:
  - `viewer-api` 및 `viewer-mcp` 서비스의 구동 커맨드에 tsconfig 컴파일 지정 플래그(`--project /app/tsconfig.json`) 보강

---

## Verification Plan

### Manual Verification
- docker compose config 검증:
  - `docker compose --profile viewer config` 실행하여 문법 무결성 검증
- docker compose build & up 검증:
  - `docker compose --profile viewer build` 빌드를 수행하여 가벼운 API/MCP 빌드가 가동되는지 검증
  - `docker compose --profile viewer up -d` 를 통한 컨테이너 정상 구동 여부 확인
