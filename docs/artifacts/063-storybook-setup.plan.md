# 063 - Storybook 개발 환경 완전 제거 및 롤백 계획서

이 계획서는 최근 추가된 Storybook 관련 도구 및 의존성 패키지가 컴파일 부하 및 로컬 네트워크 충돌을 야기함에 따라, 이를 프로젝트에서 완전히 제거(Clean-up)하고 이전 상태로 원상 복구하기 위한 계획입니다.

## Target Branch
- `develop` 또는 `feature/063-storybook-cleanup`

## User Review Required

> [!IMPORTANT]
> **원상 복구 범위**
> - `package.json`의 개발 의존성 목록에 들어간 Storybook, Playwright, Vitest 관련 패키지들을 깔끔하게 삭제합니다.
> - `.storybook/` 폴더 및 `src/stories/` 디렉토리를 통째로 제거합니다.
> - `vite.config.ts`와 `vitest.shims.d.ts` 등 수정되거나 생성된 구성 파일들을 복원합니다.

---

## Proposed Changes

### 1. 패키지 및 스크립트 복원 (`apps/viewer/src/frontend/package.json`)
* 스토리북 구동 및 빌드를 위해 주입되었던 `storybook`, `build-storybook` 실행 스크립트를 제거합니다.
* 설치된 스토리북 관련 개발용 모듈 전체를 `package.json`에서 제거하고 패키지 동기화를 수행합니다.

### 2. 파일 정리 및 청소
* `.storybook/` 및 `src/stories/` 폴더와 `vitest.shims.d.ts` 파일을 디스크에서 삭제합니다.

### 3. `vite.config.ts` 설정 복원
* 빌드 테스트 연동을 위해 주입되었던 `@storybook/addon-vitest` 및 `playwright` 설정 부분을 걷어내고 원래의 Vite Vue 빌드 설정으로 되돌립니다.

---

## Verification Plan
1. **의존성 설치 상태 확인**:
   - `npm install` 실행 후 `node_modules`가 기존 크기로 원상 복구되는지 검사.
2. **Vite 빌드 테스트**:
   - `make viewer-build viewer-up` 실행 시 스토리북 간섭 없이 성공적으로 뷰어 컨테이너가 잘 컴파일되고 기동되는지 확인.
