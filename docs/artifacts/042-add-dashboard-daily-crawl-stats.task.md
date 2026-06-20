# 📝 Task: Add Daily Crawl Statistics Dashboard & MCP Tool

이 문서는 날짜 범위별 수집 현황판 및 MCP 도구를 추가하는 작업의 작업 목록 및 진행 상황을 추적합니다.

## 🏁 진행 상황 요약
- [ ] **[Back-end] API 구현**
  - [ ] `apps/viewer/src/api/server.ts`에 `GET /api/site-stats/search` 엔드포인트 라우팅 추가
  - [ ] MongoDB `silver` DB의 각 사이트별 수집 다큐먼트 수에 대한 날짜별 집계 구현
- [ ] **[MCP Server] 도구 탑재**
  - [ ] `apps/viewer/src/mcp/mcp.ts`에 `get_crawl_stats_in_range` 도구 등록 및 마크다운 리포트 생성 로직 구현
  - [ ] `run_mongo_query` 도구 구현 (MongoDB 임의 쿼리 조회 지원)
  - [ ] `run_meili_query` 도구 구현 (Meilisearch 임의 쿼리 조회 지원)
  - [ ] `run_redis_query` 도구 구현 (Redis 간단 커맨드 조회 지원)
- [ ] **[Front-end] UI 대시보드 연동 및 시각화**
  - [ ] `apps/viewer/src/frontend/src/views/DashboardView.vue`에 날짜 범위 필터링 및 일주일 단위 이동 컨트롤 추가
  - [ ] CSS Stacked Bar Chart 구현 (HSL 테마, 툴팁, 호버 효과)
  - [ ] 백엔드 연동을 통한 실시간 데이터 시각화
- [ ] **[검증 및 완료]**
  - [ ] API 동작 로컬 테스트
  - [ ] Front-end 컴포넌트 렌더링 확인
  - [ ] 변경 이력 기록 및 자동 Git Commit 스크립트 실행

---

## 🛠️ 상세 작업 로그

### 1. API 구현
- **목표**: `/api/site-stats/search?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- **구현 내용**:
  - `startDate`, `endDate` 유효성 검사 (ISO 날짜 형식 혹은 YYYY-MM-DD 검증)
  - KST (`Asia/Seoul`) 시간대로 변환 혹은 날짜 파싱하여 MongoDB 쿼리에 적용
  - 모든 수집 사이트 컬렉션 리스트를 돌면서 날짜별 `$group` 집계 연산 수행

### 2. MCP 도구 구현
- **목표**: `get_crawl_stats_in_range`
- **구현 내용**:
  - 입력 인자: `startDate`, `endDate`
  - 각 사이트별, 날짜별 매칭되는 수집 통계를 표(Table) 형태의 마크다운 텍스트로 가독성 높게 변환하여 LLM에 응답

### 3. UI 대시보드 갱신
- **목표**: 일주일 단위로 수집 현황을 직관적인 CSS Bar Chart로 표기
- **구현 내용**:
  - CSS Flexbox/Grid와 `--val` 변수를 사용한 Pure CSS Stacked Bar Chart
  - 사이트별 컬러 매핑 (HSL 테마)
  - 마이크로 인터랙션 (호버 시 불투명도 변화 및 상세 툴팁 노출)
