# 리뷰 문서: 일별 콘텐츠 현황 자동 조회 비활성화 (094-disable-auto-crawl-stats.review.md)

## 1. 개요
- **작업명**: 일별 콘텐츠 현황 자동 조회 비활성화
- **작업자**: Antigravity
- **리뷰 대상 파일**:
  - `apps/viewer/src/frontend/src/views/DashboardView.vue`

## 2. 변경 전/후 비교
### 변경 전
- 대시보드 마운트(`onMounted`) 시점에 `fetchQueues()`, `fetchErrors()`, `fetchCrawlStats()`가 모두 자동 실행됩니다.
- 초기 로딩 시 데이터 조회 전임에도 불구하고 조회 결과가 비어있을 때 "선택된 날짜 범위에 수집된 데이터가 없습니다."라고 출력됩니다.

### 변경 후
- 대시보드 마운트(`onMounted`) 시 `fetchCrawlStats()` 호출을 주석 처리 혹은 삭제하여 자동 조회를 방지합니다.
- 초기 진입 상태(조회하기 전)와 실제 조회 결과가 없는 상태를 구분하여 사용자에게 알맞은 피드백 문구를 제공합니다.
