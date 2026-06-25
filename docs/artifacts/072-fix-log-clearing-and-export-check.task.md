# 🛠️ 할 일 목록 (072-fix-log-clearing-and-export-check.task.md)

> [!IMPORTANT]
> **Bugfix**: 동기화/내보내기 완료 후 로그창이 즉각 지워져 실제 에러를 판별할 수 없었던 UI 버그 수정 작업입니다.

---

## 📅 작업 정보
- **작업명**: Joplin 내보내기 로그 지워짐 버그 수정 및 에러 분석
- **상태**: ⏳ 진행 중

---

## 📋 세부 할 일 목록

- [x] **1. 프론트엔드 컴포넌트 수정 (`apps/viewer/src/frontend/src/views/ExternalView.vue`)**
  - [x] `loadJoplinFolders` 함수에 `shouldClear` 옵션을 기본값 `true`로 추가.
  - [x] `syncJoplinCli` 완료 직후의 `loadJoplinFolders()` 호출 시 `false` 인자 전달하여 로그 유지.
- [x] **2. 변경 사양 검토서 작성 (`docs/artifacts/072-fix-log-clearing-and-export-check.review.md`)**
  - [x] 변경 내용 검증.
- [x] **3. 서비스 빌드 및 재기동**
  - [x] 빌드 실행하여 변경 코드 반영.
- [x] **4. 서비스 검증 및 결과보고서 작성 (`docs/artifacts/072-fix-log-clearing-and-export-check.walkthrough.md`)**
  - [x] 동기화 완료 후 실제 획득된 상세 에러 분석 및 대응 결과 정리.
