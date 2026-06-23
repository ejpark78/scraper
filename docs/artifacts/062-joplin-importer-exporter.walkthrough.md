# 062 - Joplin Importer & Exporter 양방향 동기화 연동 결과보고서

이 결과보고서는 Joplin의 가져오기(Import) 및 내보내기(Export) 기능을 일원화한 External 도구를 통합 구현하고 검증한 변경 결과를 기록합니다.

## 변경 사항 요약 (Walkthrough)

1. **백엔드 라우터 및 기능 추가 (`apps/viewer/src/api/routes/exporter.ts`)**:
   * **`POST /api/exporter/joplin/folders`**: 프론트엔드가 보낸 주소(로컬인 경우 내부 컨테이너 매핑 가상 IP로 해석)와 API 토큰을 사용하여 Joplin의 노트북(폴더) 목록을 반환합니다.
   * **`POST /api/exporter/joplin/notes`**: 선택된 폴더 내의 노트를 가져옵니다.
   * **`POST /api/exporter/joplin/import`**: 선택한 노트북 내의 모든 노트들의 바디 데이터를 마크다운 포맷으로 변환하여 **`data/joplin/[노트북명]/[노트명].md`** 파일 구조로 저장합니다. 디렉토리가 부재하면 재귀 생성합니다.
   * **`POST /api/exporter/export` 및 `exportToJoplin` (`apps/viewer/src/exporter/export/joplin.ts`)**: Joplin 업로드(내보내기) 기능을 동적 URL 기반으로 작동하도록 수정하여, 로컬 환경 외의 타깃 개인 도메인 서버로 직접 내보내기가 가능해졌습니다.

2. **프론트엔드 라우팅 및 사이드바 통합 (`App.vue` & `router/index.ts`)**:
   * 기존 `Exporter` 및 `Importer` 개발 메뉴를 **`External (Joplin)`** 이라는 하나의 통합 메뉴로 묶어 제공합니다.
   * 이에 따라 vue-router에 `/external` 경로 및 `ExternalView.vue`를 맵핑하고, 사이드바를 간결하게 개편하였습니다.

3. **ExternalView 통합 뷰 구현 (`apps/viewer/src/frontend/src/views/ExternalView.vue`)**:
   * 단일 뷰에서 **"Joplin으로 내보내기 (Export)"**와 **"Joplin에서 가져오기 (Import)"**를 탭 형태로 쉽게 스위칭하여 진행할 수 있습니다.
   * 연결 도메인 설정(Joplin 로컬 웹 클리퍼 `http://127.0.0.1:41184` vs 자체 Joplin Server `https://notes.cola.pro`)을 상단에서 공통 지정할 수 있게 하였습니다.
   * 기존 사용되지 않는 Obsidian 관련 입력 폼은 프론트엔드 UI 단에서 완벽하게 제거하여 가독성을 높였습니다.
   * 사용자 편의를 위해 `localStorage`에 연결 방식 및 주소, API 토큰 상태를 연동 저장하여 새로고침하거나 탭을 전환해도 정보가 유지됩니다.

---

## 검증 및 점검 가이드 (DevOps Verification)

1. **Vite 빌드 및 컨테이너 반영**:
   * 프론트엔드 뷰의 컴파일 및 백엔드 라우트 적용을 위해 Docker Compose로 뷰어 서비스를 빌드하고 실행해 주세요:
     ```bash
     # 뷰어 컨테이너 재빌드 및 재시작
     docker compose -p scraper build viewer
     docker compose -p scraper up -d viewer
     ```

2. **기능 수동 테스트**:
   * 브라우저에서 뷰어 대시보드(`http://localhost:3000` 등) 접속 후 사이드바에서 `External (Joplin)` 메뉴로 이동합니다.
   * **가져오기(Import) 테스트**:
     * 연결 주소 기입 (`https://notes.cola.pro` 혹은 로컬 주소) 및 토큰 입력.
     * `노트북 조회` 버튼 클릭하여 사용자의 노트북 목록 바인딩 상태 확인.
     * 가져올 노트북을 선택한 후 `가져오기 실행` 클릭 ➡️ 콘솔 창의 성공 로그 및 로컬 머신의 `data/joplin/` 폴더 내에 마크다운 파일이 쌓이는지 확인합니다.
   * **내보내기(Export) 테스트**:
     * 동일하게 업로드할 로컬 서적 데이터를 선택한 뒤 `내보내기 실행`을 누르면 Joplin에 챕터가 연동 및 리소스 정렬 처리되는 것을 확인합니다.
