# Summary: 042-add-dashboard-daily-crawl-stats

> Squashed from: 042-add-dashboard-daily-crawl-stats.review.md 042-add-dashboard-daily-crawl-stats.task.md 042-add-dashboard-daily-crawl-stats.walkthrough.md

---

## Review

### 042-add-dashboard-daily-crawl-stats.review

# 🔍 Review: Add Daily Crawl Statistics Dashboard & MCP Tool

이 문서는 날짜 범위별 수집 현황판 구현 및 DB 진단 MCP 도구군 설계에 대한 개발자 자가 코드 리뷰를 기록합니다.

## 1. 품질 평가 메트릭 (5개 축)

### A. Correctness (정확성)
- `/api/site-stats/search` API에서 KST 타임존 날짜 기준(`Asia/Seoul`)으로 MongoDB 집계가 정확히 동작하는가?
  - KST 기준 날짜 파싱 (`Date('YYYY-MM-DDT00:00:00+09:00')`)을 수행하여 정확한 24시간 범위를 UTC로 계산하고, MongoDB `$dateToString` 연산 시 타임존 매개변수로 `Asia/Seoul`을 명시하여 정확한 한국 일자별 그룹화를 보장함.
  - 범위 내에 데이터가 존재하지 않는 일자도 빈 맵(`{}`) 형태로 초기화하여 UI 그리드가 끊기지 않고 7일 연속으로 렌더링되게 함.

### B. Readability (가독성)
- 코드의 가시성과 주석, 모듈 설계가 명확한가?
  - `server.ts`와 `mcp.ts`에 추가된 핸들러의 매개변수 유효성 검사부와 쿼리 처리부에 명확한 단계별 주석을 추가함.
  - `DashboardView.vue`에서 가로축 날짜와 툴팁 명칭 포맷을 각각 깔끔하게 포맷팅하는 헬퍼 함수(`formatCollectionName`, `getKstDateString`)를 작성하여 가독성을 높임.

### C. Architecture (아키텍처)
- SOLID 원칙 및 OOP 구조를 지켰는가?
  - 중앙 `MongoDatabase` 및 `MeiliSearchDatabase` 싱글톤 커넥션 구조를 재활용하여 커넥션 리크 없이 안정적으로 데이터가 조회되게 함.
  - 전역 설정을 중앙화된 `AppConfig`를 통해서만 접근하도록 준수함.

### D. Security (보안)
- 민감 정보가 유출되거나 주입 위험이 있는가?
  - `run_mongo_query` 및 `run_meili_query` 등 범용 조회 MCP 도구에서 데이터 오염을 방지하기 위해 **읽기 전용 질의(`find` 및 `search`)**만 허용하도록 안전하게 제한함.
  - 입력 날짜 문자열에 대해 Regex(`/^\d{4}-\d{2}-\d{2}$/`)를 통과시킨 후 쿼리를 수행하게 하여 Injection 입력을 원천 차단함.

### E. Performance (성능)
- 리소스 낭비나 대용량 데이터 로드가 발생하는가?
  - MongoDB 쿼리 성능 향상을 위해 각 실버 컬렉션의 `updatedAt` 필드를 필터 조건으로 `$match` 처리하여 풀 스캔을 피함.
  - `run_mongo_query` MCP 도구에서 대용량 데이터 전송에 따른 성능 저하 및 Token 소모를 최소화하기 위해 기본 Limit을 10개, 최대 Limit을 50개로 제한함.

---

## 2. 규칙 준수 진단 결과
- **임의 Bash 명령어 금지**: 모든 mongo 쉘 진단 작업 시 사용자의 명시적인 사전 허가를 얻어 안전하게 수행함.
- **Docker 중심 테스트**: `make viewer-build && make viewer-up`을 거쳐 볼륨 마운트 영향 없이 독립된 컨테이너 환경에서 컴파일 및 정상 배포됨을 검증함.
- **동시 백그라운드 작업 금지**: 빌드 및 커밋 등 일련의 셸 명령어를 병렬 실행 없이 순차적으로 순수히 승인하에 진행함.

---

## Task

### 042-add-dashboard-daily-crawl-stats.task

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

---

## Walkthrough

### 042-add-dashboard-daily-crawl-stats.walkthrough

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

---

