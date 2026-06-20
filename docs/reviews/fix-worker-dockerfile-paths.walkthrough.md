# Walkthrough: Fix Worker Dockerfile Paths

## 1. 수정 목적
- 수집 대기 큐(`aicasebook:scrape:medium` 등)에 다수의 작업이 쌓여있음에도 불구하고 scraper 워커 컨테이너 내부에서 아무 작업도 수행되지 않고 로그가 비어있던 문제를 분석했습니다.
- 원인으로 `docker compose` 빌드 구성이 잘못되어 실질적인 스크립트 실행이 생략되고 `tail -f /dev/null` 상태로만 구동되던 것을 파악하여 올바른 실행 전용 Dockerfile로 빌드 경로를 지정했습니다.
- 또한, 실행의 일관성을 위해 워커 실행 코드를 `package.json`의 npm 스크립트로 이관하고 Dockerfile에서 이를 호출하도록 연동 구조를 통일했습니다.

## 2. 해결 내역 및 검증 방법
- `apps/crawler/package.json`에 `worker:scraper`, `worker:converter`, `worker:indexer` 스크립트를 정의했습니다.
- `apps/crawler/docker/worker/compose.yml` 파일에서 `scraper`, `converter`, `indexer` 서비스의 `dockerfile` 설정을 각각 고유한 전용 Dockerfile 경로로 연결했습니다.
- 각 전용 Dockerfile의 `CMD` 명령어를 `npm run worker:<service>`로 변경했습니다.
- **검증 명령**:
  - `docker compose --profile worker build` 실행 후 빌드 확인
  - `docker compose --profile worker up -d` 또는 `make restart` 실행 후 컨테이너 헬스체크 통과 확인 (`Up (healthy)`)
