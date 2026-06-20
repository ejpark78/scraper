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
- [ ] Frontend static assets 빌드 테스트
- [ ] Docker 환경 빌드 및 통합 실행 검증
