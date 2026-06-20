# Plan: Fix Worker Dockerfile Paths

Docker Compose 구성에서 워커 서비스들이 각자의 전용 Dockerfile 대신 base Dockerfile로 빌드되어 `tail -f /dev/null`로 구동되던 문제를 해결하기 위한 빌드 설정 변경 계획입니다.

## User Review Required
> [!IMPORTANT]
> - `apps/crawler/docker/worker/compose.yml` 파일에서 `scraper`, `converter`, `indexer` 서비스의 `dockerfile` 빌드 속성이 base `Dockerfile`에서 각각 고유한 전용 `Dockerfile` 경로로 변경됩니다.
> - 변경이 적용되려면 컨테이너 재빌드(`docker compose --profile worker build`) 및 재시작(`docker compose --profile worker up -d`)이 필요합니다.

## Proposed Changes

### 1. Crawler Docker Compose Setup
- **`[MODIFY]`** `apps/crawler/docker/worker/compose.yml`:
  - `scraper` 서비스의 `dockerfile` 설정을 `docker/worker/scraper/Dockerfile`로 변경
  - `converter` 서비스의 `dockerfile` 설정을 `docker/worker/converter/Dockerfile`로 변경
  - `indexer` 서비스의 `dockerfile` 설정을 `docker/worker/indexer/Dockerfile`로 변경

---

## Verification Plan

### Manual Verification
- `docker compose --profile worker build`로 워커 컨테이너를 재빌드하고 실행 상태 및 헬스체크 결과를 확인합니다.
- `docker compose --profile worker ps` 명령으로 각 컨테이너의 상태가 `Up (healthy)`로 유지되는지 확인합니다.
- `docker compose --profile worker logs scraper` 등의 로그를 확인하여 백그라운드 워커들의 정상 기동을 점검합니다.
