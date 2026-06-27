# 결과보고서: 일별 콘텐츠 현황 자동 조회 비활성화 (094-disable-auto-crawl-stats.walkthrough.md)

## 1. 구현 요약
- **목적**: 대시보드 로딩 시 일별 콘텐츠 현황이 자동으로 호출되는 로직 비활성화
- **작업 내용**:
  - `apps/viewer/src/frontend/src/views/DashboardView.vue` 파일 수정
  - `onMounted` 생명주기 훅 내에서 `fetchCrawlStats()` 제거하여 첫 화면 로드 시 자동 API 조회를 생략함.
  - `hasQueriedStats` 상태 변수를 도입하여 조회 완료 여부를 저장하고, 조회 전일 경우에는 "📅 날짜 범위를 설정한 후 [조회] 버튼을 클릭해 주세요." 라는 가이드를 노출하여 수동 조회를 명확하게 유도함.
  - 조회 후 데이터가 없는 경우 기존의 "선택된 날짜 범위에 수집된 데이터가 없습니다." 메시지가 올바르게 출력됨.

## 2. 변경된 파일 목록 및 영향도
- [DashboardView.vue](../../apps/viewer/src/frontend/src/views/DashboardView.vue): 대시보드 화면 뷰 컴포넌트 (영향 범위: 뷰어 화면 대시보드의 일별 수집 통계 차트 영역)
- [AGENTS.md](../../apps/viewer/AGENTS.md): `apps/viewer` 프로젝트 룰에 Docker compose 기반 정적 검증 룰 추가

## 3. 검증 결과
- `docker compose build viewer-fe` 명령어를 통해 격리된 빌드 환경 내에서 프론트엔드의 정적 타입체크 및 빌드가 정상적으로 완료됨을 확인하였습니다.
