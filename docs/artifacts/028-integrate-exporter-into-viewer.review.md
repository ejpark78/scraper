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
  - **해결**: [ExporterView.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ExporterView.vue) 내 좌측 설정 폼 카드 엘리먼트에 `overflow-y: auto` 스타일을 추가하여 내용이 길어지더라도 스크롤을 통해 모든 입력 필드와 하단 실행 단추가 정상 노출 및 작동하도록 수정 완료.
