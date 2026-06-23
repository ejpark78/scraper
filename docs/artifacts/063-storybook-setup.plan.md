# 063 - Storybook 개발 환경 구축 및 구성 계획서

이 계획서는 `apps/viewer` 프론트엔드 프로젝트에 Storybook 컴포넌트 개발 및 명세 환경을 초기화하고, 모든 주요 화면 뷰 컴포넌트(`*View.vue`)의 스토리북 명세를 작성하기 위한 세부 계획입니다.

## Target Branch
- `develop` 또는 `feature/063-storybook-setup`

## User Review Required

> [!IMPORTANT]
> **패키지 설치 및 실행**
> - 스토리북은 개발 환경(`devDependencies`)에 대량의 의존성을 추가하므로, `npm install` 실행 과정이 동반됩니다.
> - 도커 환경 내의 마운트 캐시 및 패키지 충돌을 예방하기 위해, 호스트 머신의 `apps/viewer/src/frontend` 디렉토리 아래에 의존성을 설치하고 로컬 환경(호스트)에서 Storybook을 실행하는 환경을 구축합니다.

---

## Proposed Changes

### 1. 스토리북 모듈 초기화 및 의존성 설치
* `apps/viewer/src/frontend` 경로에서 스토리북 초기화 도구를 실행합니다:
  ```bash
  npx storybook@latest init --type vue3 --builder vite -y
  ```
* 이 도구는 자동으로 `.storybook/` 구성 폴더 및 예제 컴포넌트 스토리를 `src/stories/`에 생성하고 `package.json`에 `storybook` 스크립트를 추가합니다.

---

### 2. 전체 *View.vue 스토리 작성
뷰어의 모든 메인 화면 컴포넌트(`src/views/` 폴더 내)의 스토리를 정의하여 다양한 상태를 독립적으로 검증할 수 있도록 구성합니다.

#### 1) `DashboardView.stories.ts`
* **주요 구성 상태**:
  - **정상 로딩 상태**: MongoDB, Redis 큐 지표 데이터가 성공적으로 렌더링된 메인 대시보드 화면.
  - **로딩 중 상태**: 대시보드 데이터 패치 대기 스켈레톤.
  - **오류 발생 상태**: 데이터베이스 연결 실패 경고 카드 노출 상태.

#### 2) `DocumentView.stories.ts`
* **주요 구성 상태**:
  - **빈 리스트 상태**: 선택한 컬렉션에 채용 정보나 글이 존재하지 않을 때의 화면.
  - **목록 및 상세 활성 상태**: 왼쪽 리스트에서 특정 게시물을 선택하여 우측 상세 보기 패널과 탭(마크다운/HTML)이 활성화된 화면.

#### 3) `ExternalView.stories.ts`
* **주요 구성 상태**:
  - **Export 탭 활성 상태**: 대상 도서 선택 및 내보내기 진행 로그 흐름 시각화.
  - **Import 탭 활성 상태**: 노트북(폴더) 선택 드롭다운 및 로그 콘솔 연동 레이아웃 시각화.
  - **연결 방식 전환 상태**: 로컬 클리퍼 / 외부 서버에 따른 인풋 폼의 디스에이블 상태 비교.

---

## Verification Plan

### Manual Verification
1. **스토리북 로컬 서버 기동**:
   - `apps/viewer/src/frontend` 디렉토리 하위에서 스토리북 개발 모드 실행:
     ```bash
     npm run storybook
     ```
   - 브라우저로 `http://localhost:6006`에 접속하여 스토리북 관리 화면이 정상적으로 출력되는지 확인.
2. **전체 *View 스토리 렌더링 검증**:
   - 스토리북 메뉴에서 `DashboardView`, `DocumentView`, `ExternalView` 스토리를 각각 클릭하여 독립 렌더링 상태를 확인하고 CSS 스타일 삐뚤어짐이 없는지 최종 검증.
