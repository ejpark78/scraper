# 062 - Joplin Importer & Exporter 양방향 동기화 연동 계획서

이 계획서는 기존의 Joplin Web Clipper 내보내기 기능을 넘어, 자체 구축한 Joplin Server와 로컬 Web Clipper 양방향으로 서적 데이터를 가져오고(Import) 내보내는(Export) 기능을 추가 및 개선하는 구현 계획입니다.

## Target Branch
- `develop` 또는 `feature/062-joplin-integration`

## User Review Required

> [!IMPORTANT]
> **보안 및 환경 변수 취급**
> - 사용자의 개인 Joplin Server 주소 및 API 토큰은 브라우저의 `localStorage`에 안전하게 보존되며, 요청 시에만 서버 API 호출의 파라미터로 전달됩니다.

> [!NOTE]
> **연결 주소 라우팅 정책**
> - **외부 Joplin Server (`https://notes.cola.pro` 등)**: 백엔드/프론트엔드 구분 없이 입력받은 외부 도메인 URL 그대로 직접 호출합니다.
> - **로컬 Web Clipper (`http://127.0.0.1:41184`)**:
>   - **내보내기(Export)**: 브라우저(프론트엔드)에서 사용자 PC의 로컬 Joplin API 포트로 직접 요청하므로 원래의 로컬 URL 그대로 호출합니다.
>   - **가져오기(Import)**: Express 백엔드 컨테이너 내부에서 사용자 PC(호스트)의 로컬 포트로 루프백 통신해야 하므로, 이 경우에 한해서만 백엔드가 내부적으로 `host.docker.internal`을 목적지로 지정하여 호출합니다.

> [!NOTE]
> **가져오기(Import) 저장 위치**
> - Joplin에서 가져온 노트북 및 노트들은 마크다운 형식으로 프로젝트 루트의 **`data/joplin/[노트북명]/[노트명].md`** 경로에 안전하게 격리되어 저장됩니다.

---

## Proposed Changes

### 1. 백엔드 Exporter 라우트 확장 및 Joplin 연동 유연화
기존의 로컬 클리퍼 URL(`http://host.docker.internal:41184`)만 보던 방식을 클라이언트가 전송한 `apiUrl` 및 `token`을 직접 사용하도록 확장하고, 가져오기(Import)에 필요한 API를 구현합니다.

#### [MODIFY] [exporter.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/api/routes/exporter.ts)
- `POST /api/exporter/export` API 수정: 요청 본문(`req.body`)에서 `apiUrl`을 전달받아 Joplin에 동적으로 연결하도록 수정합니다.
- 신규 API 추가:
  - `POST /api/exporter/joplin/folders`: Joplin URL과 Token을 헤더/바디로 받아서 폴더(노트북) 목록을 반환합니다. (로컬 루프백 주소인 경우 `host.docker.internal`로 내부 매핑)
  - `POST /api/exporter/joplin/notes`: 특정 폴더 ID 내의 모든 노트 목록을 가져옵니다.
  - `POST /api/exporter/joplin/import`: 선택한 폴더의 노트를 다운로드하여 **`data/joplin/`** 디렉토리 아래에 서적 마크다운 폴더 구조로 저장합니다. 디렉토리가 없으면 자동 생성합니다.

#### [MODIFY] [joplin.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/exporter/export/joplin.ts)
- `exportToJoplin` 함수가 세 번째 인자로 token뿐만 아니라 `apiUrl`도 동적으로 주입받아 처리하도록 수정합니다.

---

### 2. 프론트엔드 라우팅 및 사이드바 내비게이션 추가

#### [MODIFY] [index.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/frontend/src/router/index.ts)
- `Importer` 메뉴를 위한 라우트 추가:
  ```typescript
  {
    path: '/importer',
    name: 'Importer',
    component: () => import('../views/ImporterView.vue'),
  }
  ```

#### [MODIFY] [App.vue](file:///Users/ejpark/workspace/scraper/apps/viewer/src/frontend/src/App.vue)
- 사이드바 `Operations` 섹션 하단에 `Exporter` 다음 순서로 `Importer` 항목을 추가합니다.

---

### 3. 프론트엔드 뷰 구현

#### [MODIFY] [ExporterView.vue](file:///Users/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ExporterView.vue)
- Joplin 내보내기 시 기존 로컬 클리퍼뿐만 아니라 원격 Joplin Server 주소를 기입할 수 있음을 UI 안내에 명시합니다.
- 내보내기 요청 시, 백엔드로 사용자 정의 `apiUrl`을 본문에 함께 태워 보내도록 `startExport` 연동 코드를 개선합니다.

#### [NEW] [ImporterView.vue](file:///Users/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ImporterView.vue)
- 가져오기(Import) 메인 화면 구현.
- **주요 기능**:
  - **연결 방법 설정**: 1) 로컬 Joplin Web Clipper, 2) 자체 Joplin Server.
  - **연결 속성 입력**: URL (`http://127.0.0.1:41184` 또는 `https://notes.cola.pro`), API 토큰. (`localStorage` 자동 저장 연동)
  - **폴더 연동**: '연결 테스트 & 폴더 불러오기' 클릭 시 Joplin API로 폴더 목록(`GET /folders`)을 요청하여 바인딩.
  - **임포트 실행**: 대상 폴더를 선택하고 '가져오기 실행' 클릭 시, 해당 폴더 안의 모든 노트를 가져와 마크다운 파일로 백엔드 스토리지(`data/joplin/[폴더명]`)에 빌드.
  - **진행 로그 콘솔**: 가져오기 현황(노트 생성, 에러 로깅, 이미지 처리 등)을 실시간으로 표시.

---

## Verification Plan

### Automated & Manual Verification
1. **Joplin Server 연결성 검증**:
   - 외부 Joplin Server (`https://notes.cola.pro` 등) 연동 정상 작동 확인.
   - 로컬 Web Clipper (`http://127.0.0.1:41184`)에서 가져올 때 컨테이너-호스트 가상 주소 연결성 확인.
2. **가져오기(Import) 시나리오**:
   - Importer 화면에서 API URL 및 토큰 입력 후 '폴더 불러오기' 검증.
   - 특정 노트북을 선택하고 임포트를 진행하여 로컬 `data/joplin/` 디렉토리에 마크다운 형식으로 올바르게 파일들이 저장되는지 터미널로 확인.
3. **내보내기(Export) 시나리오**:
   - Exporter 화면에서 원격 Joplin Server URL(`https://notes.cola.pro` 등)과 토큰 입력 후 내보내기 실행 시 원격 서버에 새 노트북과 노트들이 원활히 업로드되는지 확인.
