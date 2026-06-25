# 🛠️ 할 일 목록 (073-fix-joplin-export-exdev.task.md)

> [!IMPORTANT]
> **Bugfix**: 서로 다른 마운트 볼륨 간의 파일 이동(rename) 제한으로 인한 EXDEV 에러를 해결하기 위한 버그 수정 작업입니다.

---

## 📅 작업 정보
- **작업명**: Joplin 내보내기 EXDEV 에러 버그 수정
- **상태**: ⏳ 진행 중

---

## 📋 세부 할 일 목록

- [x] **1. 백엔드 라우터 임시 경로 수정 (`apps/viewer/src/api/routes/exporter.ts`)**
  - [x] `tempExportDir`의 경로를 `/tmp/joplin_export`에서 동일 마운트 볼륨 내부인 `/app/data/joplin/.tmp_export`로 교체.
- [x] **2. 변경 사양 검토서 작성 (`docs/artifacts/073-fix-joplin-export-exdev.review.md`)**
  - [x] 변경 사양 코드 분석 및 검증.
- [x] **3. 서비스 빌드 및 재기동**
  - [x] 빌드 실행하여 변경 코드 반영.
- [x] **4. 서비스 검증 및 결과보고서 작성 (`docs/artifacts/073-fix-joplin-export-exdev.walkthrough.md`)**
  - [x] 동기화 재수행 후 오류 없이 마크다운 파일 내보내기가 완료되는지 검증하고 결과보고서 작성.
