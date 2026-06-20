# Review: Fix Worker Dockerfile Paths

## 1. 개요
`apps/crawler/docker/worker/compose.yml`에서 워커 서비스들(`scraper`, `converter`, `indexer`)의 Dockerfile 경로가 base Dockerfile로 지정되어 프로세스가 정상적으로 구동되지 않고 대기 모드로 진입하던 문제를 분석하고, 올바른 Dockerfile 경로로 수정한 변경 내역을 리뷰합니다.

## 2. 변경 코드 분석
### `apps/crawler/docker/worker/compose.yml`
- **변경 전**:
  ```yaml
  scraper:
    build:
      context: ../../
      dockerfile: Dockerfile
  ```
- **변경 후**:
  ```yaml
  scraper:
    build:
      context: ../../
      dockerfile: docker/worker/scraper/Dockerfile
  ```
  `converter` 및 `indexer` 역시 마찬가지로 `docker/worker/converter/Dockerfile` 및 `docker/worker/indexer/Dockerfile`로 빌드 경로가 정확하게 바인딩되었습니다.
- **영향**:
  - 이제 컨테이너 이미지 빌드 시 각 워커 전용 `Dockerfile`이 사용되어 최종 `CMD`로 워커 프로세스(`ScraperWorker.ts` 등)가 실행됩니다.
  - 이로 인해 헬스체크(`pgrep -f ScraperWorker.ts` 등)가 활성화되고 대기 큐로부터 수집 처리가 정상화됩니다.

## 3. 자가 검증 결과
- 타입 안정성 및 구문 오류: YAML 스키마 준수 확인.
- 예외 처리: 각 Dockerfile에 적절한 CMD 인스턴스 지정 확인 완료.
