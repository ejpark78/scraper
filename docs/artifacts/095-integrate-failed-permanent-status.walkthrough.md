# 결과보고서: 영구 오류 수집 차단을 위한 failed_permanent 상태 도입 (095-integrate-failed-permanent-status.walkthrough.md)

## 1. 구현 요약
- **목적**: `HTTP 404 (Not Found)`와 같은 복구 불가능한 영구 오류가 발생한 URL들이 자동/수동 리프레시를 통해 무한 재수집되어 오류가 지속적으로 누적되는 현상을 근본적으로 해결
- **작업 내용**:
  - **[ScraperWorker.ts](../../apps/crawler/src/workers/ScraperWorker.ts) 수정**:
    - `handleScrapeFailure`에서 404 에러 등 `isPermanentError` 상태를 감지하면 MongoDB `urls` 컬렉션의 `status` 필드를 `'failed_permanent'`로 별도 구분하여 마킹합니다.
  - **[BaseRefreshUrls.ts](../../apps/crawler/src/core/BaseRefreshUrls.ts) 수정**:
    - 리프레시 쿼리 수립 시 `status: { $nin: ['failed', 'failed_permanent'] }` 조건을 추가하여 `'failed_permanent'`인 대상을 신규 수집 큐 인입 대상에서 원천적으로 배제하도록 필터를 강화했습니다.

## 2. 변경된 파일 목록 및 영향도
- [ScraperWorker.ts](../../apps/crawler/src/workers/ScraperWorker.ts): 크롤링 수집 실패 감지 및 DB 상태 기록
- [BaseRefreshUrls.ts](../../apps/crawler/src/core/BaseRefreshUrls.ts): 정기/정밀 리프레시 시 타겟 선정 로직

## 3. 검증 결과
- `docker compose build worker scraper` 명령을 수행하여 수정 사항이 반영된 상태에서도 컴파일과 빌드가 경고 및 오류 없이 성공적으로 완료됨을 확인하였습니다.
