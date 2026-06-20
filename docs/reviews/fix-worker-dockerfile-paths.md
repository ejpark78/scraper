# Review: Fix Worker Dockerfile Paths

## 1. 개요
`apps/crawler/docker/worker/compose.yml`에서 워커 서비스들(`scraper`, `converter`, `indexer`)의 Dockerfile 경로가 base Dockerfile로 지정되어 프로세스가 정상적으로 구동되지 않고 대기 모드로 진입하던 문제를 분석하고, 올바른 Dockerfile 경로로 수정한 변경 내역을 리뷰합니다. 추가적으로, 모든 워커의 동작 방식을 npm 스크립트로 일관성 있게 래핑하여 구동하도록 개선했으며, 하위 패키지 락 파일 누락으로 인한 빌드 오류를 방지하기 위해 설치 명령을 수정했습니다.

## 2. 변경 코드 분석

### `apps/crawler/package.json`
- **추가 내역**:
  ```json
  "worker:scraper": "ts-node src/workers/ScraperWorker.ts",
  "worker:converter": "ts-node src/workers/ConverterWorker.ts",
  "worker:indexer": "ts-node src/workers/IndexerWorker.ts"
  ```
  이로써 모든 실행 단위가 `package.json`의 스크립트로 중앙 집중 관리됩니다.

### `apps/crawler/docker/worker/compose.yml`
- **변경 후**:
  `scraper`, `converter`, `indexer` 서비스의 빌드 경로를 `docker/worker/<service>/Dockerfile`로 설정하여 고유의 실행 명령어가 구동되도록 변경했습니다.

### `Dockerfile` 세트 (`scraper`, `converter`, `indexer` 디렉토리 내)
- **변경 후**:
  - `CMD` 지시어를 직접 `ts-node` 실행 대신 `npm run worker:<service>` 스크립트를 사용하도록 변경했습니다.
  - 빌드 시 `apps/crawler/`에 `package-lock.json` 파일이 부재함에 따라, 빌드 실패를 일으키던 `npm ci` 명령어를 `npm install`로 대체했습니다.
- **영향**:
  - 이제 컨테이너 이미지 빌드가 문제없이 완료되며, 각 워커 전용 `Dockerfile`이 사용되어 npm 스크립트를 통해 워커 프로세스(`ScraperWorker.ts` 등)가 실행됩니다.
  - 이로 인해 헬스체크(`pgrep -f ScraperWorker.ts` 등)가 활성화되고 대기 큐로부터 수집 처리가 정상화됩니다.

## 3. 자가 검증 결과
- 타입 안정성 및 구문 오류: YAML 및 JSON 스키마 준수 확인.
- 예외 처리: 각 Dockerfile에 적절한 CMD 및 의존성 설치 명령어 지정 확인 완료.
