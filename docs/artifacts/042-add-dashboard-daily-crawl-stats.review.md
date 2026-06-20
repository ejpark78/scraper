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
