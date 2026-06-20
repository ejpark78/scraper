# 🏁 Walkthrough: Add Daily Crawl Statistics Dashboard & MCP Tool

이 결과보고서는 대시보드 날짜 범위별 수집 현황판 기능과 데이터베이스 진단용 4종 MCP 도구군 추가의 구현 세부 정보 및 동작 검증 결과를 기술합니다.

## 1. 구현 내용 최종 요약

이번 마일스톤(Major 등급 변경)을 통해 개발자와 코딩 에이전트 모두가 크롤링 및 수집 이상 상태를 즉각 파악할 수 있는 진단/시각화 아키텍처를 완성했습니다.

### 백엔드 (Express / API)
- **추가 API**: `GET /api/site-stats/search`
- **기능**: 날짜 범위(`startDate`, `endDate`)를 기반으로 MongoDB `silver` 데이터베이스의 모든 컬렉션에서 `updatedAt` 필드를 기준 삼아 하루 단위로 데이터 적재 수량을 집계하여 반환합니다.

### 프론트엔드 (Vue 3 / CSS Chart)
- **차트 컴포넌트 추가**: `DashboardView.vue`
- **시각화 기술**: 외부 패키지 설치 없이 **CSS Stacked Bar Chart**를 자작 구현하여 브라우저 가용성을 높였습니다.
  - **테마**: HSL 기반의 색상 테마 매핑 (`linkedin.jobs` -> Blue, `geeknews` -> Orange 등).
  - **인터랙션**: 막대 호버 시 입체적인 반투명 오버레이 효과 및 해당 일자별 수집 상세 리스트를 띄우는 부드러운 애니메이션 툴팁.
  - **컨트롤**: 날짜 입력 필드를 통한 동적 조회 및 일주일 단위로 전후 이동할 수 있는 내비게이션 컨트롤 연동.

### 에이전트 진단 인프라 (MCP Server & Config)
- **MCP 도구 신규 탑재**: `apps/viewer/src/mcp/mcp.ts`
  1. `get_crawl_stats_in_range`: 지정한 날짜 범위에 대해 마크다운 테이블 리포트 형식으로 수집 통계를 반환.
  2. `run_mongo_query`: MongoDB 데이터를 쿼리 필터 및 프로젝션 옵션과 함께 조회 (Limit 최대 50개 제한).
  3. `run_meili_query`: Meilisearch 인덱스 상태 및 저장 문서를 직접 검색.
  4. `run_redis_query`: Redis 큐(`convert_queue`, `index_queue` 등) 및 캐시 키 진단.
- **클라이언트 설정 연동**: `.mcp.json`에 `viewer-mcp` SSE 엔드포인트(`https://mcp.localhost/sse`)를 등록하여 코딩 에이전트가 데이터베이스를 직접 진단할 수 있도록 채널을 개방함.

---

## 2. 검증 및 결과 확인
1. **API 및 빌드 검증**: 
   - `make viewer-build && make viewer-up`을 실행하여 Docker 컨테이너의 격리 컴파일 환경에서 컴포넌트 전체가 정상 빌드 및 재배포되었습니다.
2. **동적 UI**: 
   - 뷰어 대시보드에 접속 시, 기본값으로 오늘 기준 최근 일주일(7일)의 수집 그래프가 HSL 테마에 맞춰 Stacked Bar 형태로 이상 없이 출력됩니다.
   - 날짜를 바꾼 후 '조회'를 누르거나 '이전 주 / 다음 주' 버튼을 누르면 API 호출이 유기적으로 연동됩니다.
3. **규칙 준수**: 
   - 전반적인 아티팩트 라이프사이클(`plan`, `task`, `review`, `walkthrough` 4종 세트)을 모두 준수하였습니다.
