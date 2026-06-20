# ADR 0003: Monorepo Restructuring and Python Ebook Service Integration

## Status
Approved

## Context
프로젝트에 다양한 기술 정보 수집원(LinkedIn Jobs, Gmail 메일링 리스트, 기술 서적 등)이 추가되고 파이썬(Python) 기반의 기술 서적 변환 도구(`../ebook`)가 도입되면서 다음의 한계가 식별되었습니다.
1. **의존성 및 빌드 충돌**: 타입스크립트 기반 크롤러 빌드 환경과 파이썬 런타임/의존성 환경을 한 디렉토리에 혼용할 시 타입 컴파일러와 린터, 런타임 빌드 도구들의 상호 간섭이 우려되었습니다.
2. **자원 낭비**: 일회성 배치 형태인 서적 마이그레이션 도구가 상시 가동되는 백엔드 API/크롤러 워커들과 함께 시작될 때 시스템 자원(CPU, 메모리)의 비효율적 점유가 일어납니다.
3. **지식 베이스 연동 파편화**: 파이썬 결과물로 생성되는 Markdown 데이터를 타입스크립트 데이터 허브(MongoDB 및 Meilisearch)에 일관성 있게 밀어 넣어주는 표준 동기화 인터페이스가 부재했습니다.

## Decision
이 문제를 극복하고 장기적인 스케일링을 도모하기 위해 다음과 같은 아키텍처적 결정을 내렸습니다.

### 1. 서비스 중심 모노레포(Monorepo) 구조로의 전면 개편
프로젝트 루트를 다중 패키지 워크스페이스 형태로 리팩토링합니다.
- **`/apps`**: 독립적으로 기동되는 개별 애플리케이션 서비스들을 배치합니다.
  - `apps/crawler`: TS 기반 수집기, 컨버터, 인덱서 워커 및 동기화 스크립트 모음
  - `apps/viewer`: 웹 프론트엔드 및 API / MCP 서버
  - `apps/ebook`: 파이썬 기반 서적 파서 및 분석기
- **`/packages`**: 여러 서비스에서 재사용하는 공통 모듈을 추출하여 패키지화합니다.
  - `packages/database`: MongoDB, Redis, Meilisearch용 공통 드라이버 커넥터
  - `packages/config`: 공통 환경설정 로더
- **`/data`**: 프로젝트 전반에서 사용되는 파일 시스템 데이터 경로를 루트 `/data/` 하위로 일원화하고 하위 폴더별(예: `/data/ebook/`)로 통합합니다.

### 2. Docker Compose `profiles`를 통한 리소스 격리
- 파이썬 기반 `ebook` 컨테이너 서비스를 `compose.yml` 및 `docker/worker/compose.yml` 에 정의하되, `profiles: ["ebook"]` 속성을 부여합니다.
- 기본 웹/워커 스택 구동 시에는 ebook 컨테이너 빌드 및 런타임 부팅을 완전히 제외하여 로컬 자원을 아끼고, 필요할 때만 명시적 프로파일을 통해 일회성 실행할 수 있도록 제어합니다.

### 3. 타입스크립트 표준 데이터 동기화 파이프라인 수립
- 파이썬 스크립트가 뱉어내는 챕터별 Markdown 결과물을 데이터베이스에 밀어 넣어주는 TS 기반 동기화 CLI 스크립트([sync-ebooks.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/scripts/sync-ebooks.ts))를 작성합니다.
- 이 스크립트가 MongoDB 적재 완료 후 Redis `index_queue`에 작업 ID를 Push하면, 기존 크롤러용 `IndexerWorker`가 이 태스크를 꺼내 Meilisearch에 검색 연동을 완료하도록 하여 중복 설계 없이 파이프라인 시너지를 높였습니다.

## Consequences
- **의존성 격리**: 타입스크립트 환경(`package.json`, `tsconfig.json`)과 파이썬 환경(`pyproject.toml`, `uv.lock`)이 각자의 서비스 경계 내부로 완벽하게 은닉 및 격리되었습니다.
- **로컬 리소스 효율성**: 평소에 위키 검색 화면과 크롤러를 돌릴 때 파이썬 엔진이 실행되지 않으므로 컴퓨터 자원을 절약합니다.
- **RAG/검색 통합 단순성**: 모든 이종 지식(채용공고, 뉴스레터, 기술서적)이 단일 MongoDB Silver 및 Meilisearch 지식 베이스로 깔끔하게 수렴되어, 향후 RAG 개발 시 한 지점의 인덱스만 조회하여 연동하면 되도록 단순화되었습니다.
