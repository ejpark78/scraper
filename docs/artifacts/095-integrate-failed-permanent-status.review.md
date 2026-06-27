# 리뷰 문서: 영구 오류 수집 차단을 위한 failed_permanent 상태 도입 (095-integrate-failed-permanent-status.review.md)

## 1. 개요
- **작업명**: 영구 오류 수집 차단을 위한 failed_permanent 상태 도입
- **작업자**: Antigravity
- **리뷰 대상 파일**:
  - `apps/crawler/src/workers/ScraperWorker.ts`
  - `apps/crawler/src/core/BaseRefreshUrls.ts`

## 2. 변경 전/후 비교
### 변경 전
- `ScraperWorker.ts`: HTTP 404와 같은 영구 오류 발생 시 `urls` 컬렉션의 상태를 일반 실패와 동일하게 `status: 'failed'`로만 기록합니다.
- `BaseRefreshUrls.ts`: 리프레시 쿼리 실행 시 `status: { $ne: 'failed' }` 조건만 검사하므로, 영구 에러 상태가 아닌 경우에 다시 큐에 주입됩니다.

### 변경 후
- `ScraperWorker.ts`: HTTP 404 오류일 때 `status: 'failed_permanent'`로 정밀 구분하여 기록합니다.
- `BaseRefreshUrls.ts`: 수집 대상 쿼리에서 `status: { $nin: ['failed', 'failed_permanent'] }` 조건을 적용하여 영구 실패 URL이 수동/자동 리프레시로 다시 재수집되지 않도록 완전히 배제합니다.
