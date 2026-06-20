# Plan: Fix Worker Dockerfile Paths

Docker Compose 구성에서 워커 서비스들이 각자의 전용 Dockerfile 대신 base Dockerfile로 빌드되어 `tail -f /dev/null`로 구동되던 문제를 해결하고, 이들의 실행 방식을 npm 스크립트로 일관되게 바인딩하기 위한 빌드 설정 변경 계획입니다.

## User Review Required
> [!IMPORTANT]
> - `apps/crawler/docker/worker/compose.yml` 파일에서 `scraper`, `converter`, `indexer` 서비스의 `dockerfile` 빌드 속성이 base `Dockerfile`에서 각각 고유한 전용 `Dockerfile` 경로로 변경됩니다.
> - `apps/crawler/package.json` 스크립트에 데몬형 워커들을 실행하는 스크립트(`worker:scraper`, `worker:converter`, `worker:indexer`)가 새롭게 추가됩니다.
> - 각 전용 `Dockerfile` 내부의 `CMD` 실행 명령어가 직접 실행에서 `npm run worker:<service>` 스크립트 실행으로 이관됩니다.
> - `apps/crawler/` 하위에 `package-lock.json` 파일이 존재하지 않으므로, 각 전용 Dockerfile 내 의존성 설치 명령어가 `npm ci`에서 `npm install`로 전환됩니다.
> - 변경이 적용되려면 컨테이너 재빌드(`docker compose --profile worker build`) 및 재시작(`docker compose --profile worker up -d`)이 필요합니다.

## Proposed Changes

### 1. Crawler Configuration (NPM 스크립트 추가)
- **`[MODIFY]`** `apps/crawler/package.json`:
  - `worker:scraper`: `ts-node src/workers/ScraperWorker.ts` 등록
  - `worker:converter`: `ts-node src/workers/ConverterWorker.ts` 등록
  - `worker:indexer`: `ts-node src/workers/IndexerWorker.ts` 등록

### 2. Crawler Docker Compose Setup
- **`[MODIFY]`** `apps/crawler/docker/worker/compose.yml`:
  - `scraper` 서비스의 `dockerfile` 설정을 `docker/worker/scraper/Dockerfile`로 변경
  - `converter` 서비스의 `dockerfile` 설정을 `docker/worker/converter/Dockerfile`로 변경
  - `indexer` 서비스의 `dockerfile` 설정을 `docker/worker/indexer/Dockerfile`로 변경

### 3. Dedicated Dockerfiles Update
- **`[MODIFY]`** `apps/crawler/docker/worker/scraper/Dockerfile`
- **`[MODIFY]`** `apps/crawler/docker/worker/converter/Dockerfile`
- **`[MODIFY]`** `apps/crawler/docker/worker/indexer/Dockerfile`:
  - 각 Dockerfile의 `CMD` 설정을 `npm run worker:<service>` 호출 방식으로 수정
  - `package-lock.json` 누락 문제를 방지하기 위해 `npm ci`를 `npm install`로 대체

---

## Verification Plan

### Manual Verification
- `docker compose --profile worker build`로 워커 컨테이너를 재빌드하고 실행 상태 및 헬스체크 결과를 확인합니다.
- `docker compose --profile worker ps` 명령으로 각 컨테이너의 상태가 `Up (healthy)`로 유지되는지 확인합니다.
- `docker compose --profile worker logs scraper` 등의 로그를 확인하여 백그라운드 워커들이 npm 스크립트를 통해 정상 기동하는지 점검합니다.
