# 📚 [Plan] Exporter 모듈의 Viewer 서비스 통합 및 라우터 구조 도입 계획서

본 문서는 `apps/exporter` 코드를 `apps/viewer` 프로젝트로 마이그레이션하고, 백엔드 Express Router 및 프론트엔드 Vue Router를 도입하여 웹 대시보드 내에서 Joplin 및 Obsidian 내보내기 기능을 GUI로 사용할 수 있도록 통합하는 설계 계획을 정의합니다.

---

## 1. 개요 및 목적
기존의 CLI 기반 `apps/exporter` 도구를 `apps/viewer`로 마이그레이션하여, 대시보드 웹 UI에서 수집된 콘텐츠(예: 위키독스 서적 등)를 Joplin 또는 Obsidian으로 쉽게 보낼 수 있도록 웹 GUI 환경을 구축합니다.
이를 위해 백엔드는 Express Router를 도입하여 모듈화하고, 프론트엔드는 Vue Router를 도입하여 다중 페이지 아키텍처로 개편합니다.

---

## 2. 시스템 아키텍처 및 데이터 흐름

### 2.1. 백엔드 라우팅 및 비즈니스 레이어
* **Express Entrypoint**: [server.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/api/server.ts)
* **Sub-Router**: `/api/exporter` -> [exporter.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/api/routes/exporter.ts)
* **Exporter Logic Core**: [apps/viewer/src/exporter](file:///home/ejpark/workspace/scraper/apps/viewer/src/exporter) 내부로 이관
  ```
  apps/viewer/src/exporter/
  ├── types.ts
  ├── export/
  │   ├── base.ts
  │   ├── joplin.ts
  │   └── obsidian.ts
  ├── generators/
  │   └── index.ts
  └── utils/
      └── fileLoader.ts
  ```

### 2.2. 프론트엔드 라우팅 및 뷰 구성
* **Vue Router**: [router/index.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/router/index.ts)
  * `/` -> `/dashboard` (Redirect)
  * `/dashboard` -> `DashboardView.vue` (대시보드 메트릭스, 큐 현황, 컨테이너 로그)
  * `/collection/:id?` -> `DocumentView.vue` (기존 문서 검색 및 상세 조회)
  * `/exporter` -> `ExporterView.vue` (신규 Joplin/Obsidian 내보내기 화면)
* **Base Layout**: [App.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/App.vue)
  * Sidebar 레이아웃 및 전체 공통 쉘 구성

---

## 3. 구현 상세 계획

### 3.1. 백엔드 API 명세
* **`GET /api/exporter/books`**
  * **설명**: `/app/data/ebook/output/` 디렉토리 아래에 있는 사용 가능한 서적 폴더 리스트를 반환합니다.
  * **응답**: `string[]` (폴더명 목록)
* **`POST /api/exporter/export`**
  * **설명**: Joplin 또는 Obsidian으로 내보내기를 시작합니다.
  * **요청 본문 (JSON)**:
    ```json
    {
      "target": "joplin" | "obsidian",
      "path": "/app/data/ebook/output/폴더명",
      "token": "Joplin 토큰 (joplin 필수)",
      "key": "Obsidian REST API 키 (obsidian 필수)",
      "addFrontmatter": true,
      "createIndex": true
    }
    ```
  * **응답**: `{ success: true, message: "..." }` 또는 에러 응답

### 3.2. 프론트엔드 뷰 분리 설계
1. **`App.vue` 리팩토링**:
   * Sidebar 구조는 그대로 유지하되, 리스트 클릭 시 상태 변수 변경 대신 Router Link(`/dashboard`, `/collection/id`, `/exporter`)로 페이지를 전환하도록 변경합니다.
   * `currentCollection` 상태 변수를 라우터의 `$route.params.id` 및 현재 경로명으로 대체하여 반응형으로 연결합니다.
2. **`ExporterView.vue` 개발**:
   * 내보내기 가능한 서적 리스트를 드롭다운(Select)으로 제공하고 직접 경로를 입력할 수도 있게 설계합니다.
   * Joplin/Obsidian 탭을 통해 각각 필요한 API Token / Key 설정을 받고 브라우저의 `localStorage`에 자동 보관하여 재입력 불편을 줄입니다.
   * "내보내기 실행" 버튼을 누르고 진행 중 상태 표시와 성공/실패 로그 메시지를 실시간으로 모니터링합니다.

---

## 4. 검증 및 배포 계획
* **빌드 검증**: `apps/viewer` 프로젝트의 컴파일 성공 여부 및 Frontend static build(Vite) 결과 검증
* **서비스 재구동**: Docker compose를 이용한 배포 이미지 갱신
  * `docker compose build viewer` 및 `docker compose up -d --build viewer` 실행 권장 (사용자 협업 수행)
