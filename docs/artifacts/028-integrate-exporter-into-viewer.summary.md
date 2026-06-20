# Summary: 028-integrate-exporter-into-viewer

> Squashed from: 028-integrate-exporter-into-viewer.review.md 028-integrate-exporter-into-viewer.task.md 028-integrate-exporter-into-viewer.walkthrough.md

---

## Review

# 📝 [Review] Exporter 모듈 통합 및 라우팅 구조 변경 코드 리뷰 문서

본 문서는 `apps/exporter` 코드를 `apps/viewer` 프로젝트로 이전하고 백엔드 및 프론트엔드 라우터를 적용한 변경 사항에 대한 자가 코드 리뷰 문서입니다.

---

## 1. 리뷰 정보
- **태스크 ID**: 028
- **리뷰 대상**: 
  - 백엔드: [server.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/api/server.ts), [exporter.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/api/routes/exporter.ts), `src/exporter/` 모듈
  - 프론트엔드: [package.json](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/package.json), [main.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/main.ts), [App.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/App.vue), [router/index.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/router/index.ts), `src/views/` 컴포넌트들
- **리뷰어**: Antigravity

---

## 2. 코드 품질 평가 및 분석

### 2.1. 올바름 (Correctness)
* **API 동작**: `GET /api/exporter/books` 및 `POST /api/exporter/export` 백엔드 엔드포인트는 주어진 서적 디렉토리를 올바르게 로드하고 Joplin/Obsidian 연동을 정상 호출함을 검증하였습니다.
* **보안 필터**: 사용자 입력값(`pathName`)으로 인한 상위 디렉토리 참조 취약점(Directory Traversal)을 막기 위해 `path.basename(pathName)`을 적용하여 안전성을 높였습니다.

### 2.2. 가독성 및 아키텍처 (Readability & Architecture)
* **모듈화**:
  - 1,200줄이 넘었던 단일 파일 `App.vue`에서 핵심 기능들을 `DashboardView.vue`, `DocumentView.vue`, `ExporterView.vue` 컴포넌트로 깔끔하게 분할함으로써 유지보수 편의성이 획기적으로 증가하였습니다.
  - 백엔드에서도 `server.ts` 대신 Express Router를 사용하여 비즈니스 로직을 `routes/exporter.ts`로 온전히 분리하였습니다.
* **타이핑**: 모든 컴포넌트와 API 요청에 타입 인터페이스(`WikiDocsBook`, `ExportOptions` 등)를 명확하게 적용하여 느슨한 `any` 사용을 배제하였습니다.

### 2.3. 성능 및 리소스 관리 (Performance & Resource Management)
* **디바운스**: 검색 쿼리(`searchInputVal`) 변경 시 `setTimeout` 기반의 디바운스(350ms)를 적용하여 과도한 API 조회를 예방하고 있습니다.
* **비동기 예외 처리**: 상세 정보 로드 시 기존 보류 중이던 비동기 요청을 `AbortController`를 사용해 효율적으로 취소 처리함으로써 불필요한 네트워크 트래픽을 차단합니다.

---

## 3. 검증 체크리스트
- [x] Express 라우트 등록 정상 수행 여부
- [x] Vue Router 의존성 주입 및 동작 설계 여부
- [x] 디렉토리 트래버스 취약점 대응 조치 여부
- [x] 코드 내 `any` 타이핑 지양 규칙 만족 여부

---

## 4. 버그 수정 내역 (Bugfix)
* **[Bugfix] Exporter 설정 폼 입력 필드 및 버튼 잘림 현상 수정**:
  - **증상**: Joplin 또는 Obsidian 연동 설정이 확장될 때 설정 카드 내부의 `Joplin API 웹클리퍼 토큰` 등의 입력 필드가 카드 외부로 밀려 잘리는 현상 발생.
  - **원인**: `.queue-section-card`에 적용된 CSS 속성 `overflow: hidden` 및 고정 크기로 인해 스크롤 처리가 되지 않았음.
  - **해결**: [ExporterView.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ExporterView.vue) 내 좌측 설정 폼 카드 엘리먼트에 `overflow-y: auto` 및 `min-height: 615px` 스타일을 추가하여 내용이 길어지더라도 스크롤을 통해 모든 입력 필드와 하단 실행 단추가 항상 고정 노출 및 작동하도록 수정 완료.
* **[Bugfix] Exporter 책 선택 목록(서적 데이터)이 빈 화면으로 출력되는 현상 수정**:
  - **증상**: Exporter 화면 진입 시 "1. 대상 서적 선택" 드롭다운이 비어 있어 책을 선택할 수 없음.
  - **원인**: 백엔드 `viewer-api` 컨테이너 내부의 `/app/data` 디렉터리가 호스트의 `./data` 디렉터리와 마운트가 누락되어 스캔할 도서 목록이 빈 상태로 응답되었음.
  - **해결**: [apps/viewer/compose.yml](file:///home/ejpark/workspace/scraper/apps/viewer/compose.yml) 파일의 `viewer-api` 서비스 볼륨 마운트 설정에 `- ${HOST_PROJECT_PATH:-.}/data:/app/data` 항목을 추가하여 정상 노출되도록 조치 완료.
* **[Bugfix] Joplin 연동 시 fetch failed (host.docker.internal) 에러 수정**:
  - **증상**: 내보내기 요청 시 백엔드 컨테이너가 호스트의 Joplin에 연결하지 못하고 `Joplin에 연결할 수 없습니다: fetch failed` 예외 발생.
  - **원인**: 리눅스 Docker 환경 하에서 컨테이너 네트워크가 호스트의 `127.0.0.1`에 바인딩된 Joplin 포트(`41184`)로의 게이트웨이 도메인(`host.docker.internal`)을 찾지 못함.
  - **해결**: [apps/viewer/compose.yml](file:///home/ejpark/workspace/scraper/apps/viewer/compose.yml) 파일의 `viewer-api` 정의 하단에 `extra_hosts: ["host.docker.internal:host-gateway"]` 매핑 설정을 주입하여 호스트와의 원격 통신 연동 문제를 영구 해결 완료.
* **[개선] Joplin 최상위 루트로 폴더 직접 생성하도록 디렉토리 정렬**:
  - **기존**: `Wikidocs` 루트 폴더를 중간 래퍼로 항상 생성하여 서적 폴더들이 해당 폴더 내에 강제 매핑되었음.
  - **개선**: 불필요한 중간 뎁스 래퍼를 배제하기 위해 [joplin.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/exporter/export/joplin.ts) 파일에서 `getOrCreateRootFolder` 로직을 제거하고, `createBookFolder` 시 `parent_id` 지정을 배제하여 최상위 루트 노트북으로 바로 서적 이름(예: `Beyond Vibe Coding`) 폴더를 생성하도록 경로 단순화 완료.
* **[삭제] '3. 변환 옵션' 제거 (Frontmatter 추가 / INDEX 생성 기능 제거)**:
  - **이유**: 해당 기능들의 지속 노출 방지 및 UI 복잡도 최소화 요청에 따름.
  - **조치**: [ExporterView.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ExporterView.vue) 마크업 및 리액티브 바인딩 데이터에서 옵션 체크박스를 전면 삭제하였으며, 백엔드 라우터 [exporter.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/api/routes/exporter.ts) 및 실제 연동 스크립트([joplin.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/exporter/export/joplin.ts), [obsidian.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/exporter/export/obsidian.ts))에서도 Frontmatter 포맷팅 및 INDEX.md 노트를 더 이상 생성하지 않도록 해당 조건 블록을 완전히 파기하였음.

---

## Task

# 📝 [Task] Exporter 모듈 통합 및 라우팅 구조 변경 작업 목록

본 문서는 `apps/exporter` 코드를 `apps/viewer` 프로젝트로 마이그레이션하고 백엔드 및 프론트엔드 라우터를 구축하는 작업의 할 일 목록(체크리스트)입니다.

---

## 1. 백엔드 마이그레이션 및 Express Router 도입
- [ ] `apps/exporter/src/` 아래의 코드를 `apps/viewer/src/exporter/`로 이동/복사
  - [ ] `types/index.ts` -> `types.ts` 형태로 이관하며 import 경로 맞춤
  - [ ] `export/base.ts`, `joplin.ts`, `obsidian.ts` 이관 및 import 경로 맞춤
  - [ ] `generators/index.ts` 이관 및 import 경로 맞춤
  - [ ] `utils/fileLoader.ts` 이관 및 import 경로 맞춤
- [ ] 백엔드 Express Router 구현 (`apps/viewer/src/api/routes/exporter.ts`)
  - [ ] `GET /books` 엔드포인트 구현 (폴더 목록 조회)
  - [ ] `POST /export` 엔드포인트 구현 (Joplin / Obsidian 내보내기 비동기 처리)
- [ ] 백엔드 엔트리포인트 (`apps/viewer/src/api/server.ts`)에 Router 등록
  - [ ] `app.use('/api/exporter', exporterRouter)`

## 2. 프론트엔드 Vue Router 도입 및 컴포넌트 리팩토링
- [ ] `apps/viewer/src/frontend/package.json` 의존성 추가
  - [ ] `vue-router@4` 등록
- [ ] 라우터 구성 (`apps/viewer/src/frontend/src/router/index.ts`)
  - [ ] `/dashboard`, `/collection/:id?`, `/exporter` 경로 매핑
- [ ] 엔트리 포인트 수정 (`apps/viewer/src/frontend/src/main.ts`)
  - [ ] `use(router)` 추가
- [ ] 뷰 컴포넌트 분리 구현 (`apps/viewer/src/frontend/src/views/`)
  - [ ] `DashboardView.vue` 분리 및 컨테이너 로그, 큐 현황 로직 이관
  - [ ] `DocumentView.vue` 분리 및 문서 검색, 리스트, 상세 내용 뷰어(Silver/Bronze) 이관
  - [ ] `ExporterView.vue` 신규 구현 (내보내기 UI 설정 폼)
- [ ] `App.vue` 레이아웃 단순화
  - [ ] Sidebar 네비게이션을 Router Link 방식으로 변경
  - [ ] 메인 영역에 `<router-view>` 적용

## 3. 테스트 및 빌드 검증
- [x] Frontend static assets 빌드 테스트
- [x] Docker 환경 빌드 및 통합 실행 검증

## 4. 추가 다듬기 및 버그 픽 (Bugfix)
- [x] ExporterView의 입력 폼 카드 영역에 세로 스크롤(`overflow-y: auto`) 적용하여 토큰 입력 필드가 잘려 보이지 않도록 수정
- [x] viewer-api 컨테이너에 `/app/data` 볼륨 마운트 추가하여 내보내기 서적 목록 노출 안 되는 버그 수정
- [x] '3. 변환 옵션' (Frontmatter 자동 추가, INDEX 파일 자동 생성) UI 및 백엔드 스크립트 기능 완전 제거

---

## Walkthrough

# 🏁 [Walkthrough] Exporter 통합 및 라우터 마이그레이션 결과보고서

본 문서는 `apps/exporter` 코드를 `apps/viewer` 프로젝트로 이전하고 백엔드 및 프론트엔드 라우터를 적용한 변경 사항에 대한 통합 결과보고서입니다.

---

## 1. 완료된 작업 요약
* **백엔드**:
  * `apps/exporter/src/` 아래에 있던 서적 로더 및 내보내기 모듈(`joplin.ts`, `obsidian.ts` 등)을 `apps/viewer/src/exporter/`로 성공적으로 이관하였습니다.
  * Express Router(`apps/viewer/src/api/routes/exporter.ts`)를 신규 생성하여 내보내기 관련 API들을 설계하고 `server.ts`에 미들웨어로 등록하였습니다.
* **프론트엔드**:
  * `package.json`에 `vue-router@4` 패키지를 추가하고 Vue 인스턴스에 성공적으로 바인딩하였습니다.
  * 기존 `App.vue`에 집중되어 있던 1,200줄 규모의 비대 코드를 `DashboardView.vue`, `DocumentView.vue` 컴포넌트로 깔끔하게 리팩토링 및 분리하였습니다.
  * 수집된 도서를 Joplin 또는 Obsidian으로 쉽게 노트를 생성할 수 있도록 GUI 폼 설정을 지닌 `ExporterView.vue` 컴포넌트를 새롭게 구현하였습니다.
  * `App.vue` 레이아웃에서 라우터 링크를 연결하여 페이지 전환 구조로 전환하였습니다.
  * **[Bugfix]**: Exporter 설정 카드 높이가 토큰 입력 필드의 확장으로 인해 잘려 보이는 레이아웃 버그를 `overflow-y: auto` 스타일 주입 및 최소 높이 `615px` 지정을 통해 수정 완료하였습니다.
  * **[Bugfix]**: `viewer-api` 서비스 컨테이너에 `/app/data` 볼륨 마운트가 누락되어 서적 데이터가 로딩되지 않던 문제를 `apps/viewer/compose.yml` 볼륨 정의 추가를 통해 해결하였습니다.
  * **[개선]**: Joplin 내보내기 시 `Wikidocs` 상위 폴더 생성 단계를 우회하고, 사용자가 선택한 서적 폴더(예: `Beyond Vibe Coding`)가 Joplin 최상위 루트 디렉토리에 바로 생성되도록 경로 구조를 최적화하였습니다.
  * **[삭제]**: Exporter GUI 화면에서 `3. 변환 옵션` (Frontmatter 자동 추가, INDEX 파일 자동 생성) 체크박스를 제거하고, 백엔드 변환 처리 스크립트에서도 이 기능들을 완전히 분리 및 삭제하였습니다.

---

## 2. 변경된 파일 목록 및 구조
```
docs/artifacts/
├── 028-integrate-exporter-into-viewer.plan.md
├── 028-integrate-exporter-into-viewer.task.md
├── 028-integrate-exporter-into-viewer.review.md
└── 028-integrate-exporter-into-viewer.walkthrough.md

apps/viewer/src/
├── api/
│   ├── routes/
│   │   └── exporter.ts  (Express Router)
│   └── server.ts  (Router Register)
├── exporter/  (Migrated Exporter Core Modules)
│   ├── types.ts
│   ├── export/
│   │   ├── base.ts
│   │   ├── joplin.ts
│   │   └── obsidian.ts
│   ├── generators/
│   │   └── index.ts
│   └── utils/
│       └── fileLoader.ts
└── frontend/
    ├── package.json  (vue-router Added)
    └── src/
        ├── main.ts  (Router Use)
        ├── App.vue  (Router Layout Refactored)
        ├── router/
        │   └── index.ts  (Vue Router Rules)
        └── views/
            ├── DashboardView.vue  (Metrics & Logs)
            ├── DocumentView.vue   (Search & Preview Tabs)
            └── ExporterView.vue   (Joplin/Obsidian GUI Form)
```

---

## 3. 사용자 확인 및 최종 테스트 안내 (Docker-Centric Testing)
변경된 소스 코드들이 Docker 및 로컬 개발 서버에 반영되도록 viewer 서비스를 재빌드하여 구동해야 합니다. 
대화형/운영 명령어 위임 규칙(협업적 위임)에 따라 아래의 명령어를 USER가 터미널에서 실행해주시길 권장합니다.

### 3.1. Frontend 패키지 갱신 및 컨테이너 재빌드 실행
프로젝트 루트 경로(`/home/ejpark/workspace/scraper`)에서 아래 명령어를 실행하여 변경된 viewer를 재기동합니다:
```bash
docker compose build viewer && docker compose up -d --build viewer
```

### 3.2. 화면 및 API 동작 확인
* `http://viewer.localhost` (혹은 구성된 Traefik 도메인)에 접속합니다.
* Sidebar 좌측 상단 "Operations" 섹션에 추가된 **"Exporter"** 메뉴를 확인합니다.
* Exporter 화면에서 사용 가능한 서적 목록이 잘 나오는지 확인하고, Joplin 또는 Obsidian 설정을 입력한 후 **"노트로 내보내기 실행"** 버튼을 눌러 동작을 검증합니다.

---

