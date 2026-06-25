# 📋 작업 계획서: Joplin 내보내기 cross-device link (EXDEV) 에러 해결 (073-fix-joplin-export-exdev.plan.md)

이 문서는 Joplin 내보내기 시 임시 경로(`/tmp`)와 실제 저장 경로(`/app/data/joplin`) 간의 파일 시스템 디바이스 경계 이동 문제로 발생한 `EXDEV: cross-device link not permitted` 오류를 해결하는 계획을 수립합니다.

---

## 1. 🔍 문제 원인 분석

- **오류 메시지**: `EXDEV: cross-device link not permitted, rename '/tmp/joplin_export/...' -> '/app/data/joplin/...'`
- **원인**:
  - 리눅스 및 Docker 환경에서 `/tmp`는 컨테이너 내부의 오버레이(Overlay) 파일 시스템을 사용하는 반면, `/app/data`는 호스트 볼륨이 마운트된 다른 파일 시스템(디바이스)입니다.
  - Node.js의 `fs.renameSync`는 물리적으로 다른 두 파일 시스템(디바이스) 간의 디렉토리 이동을 지원하지 않아 `EXDEV` 에러를 발생시킵니다.

---

## 2. 🛠️ 해결 방안

### 개선: 임시 내보내기 디렉토리를 동일 볼륨 내부로 이동
- 임시 작업 경로를 기존의 `/tmp/joplin_export/...` 대신, 실제 마운트된 저장소 내부인 `/app/data/joplin/.tmp_export/...` 경로로 지정합니다.
- 동일한 마운트 지점(`/app/data/`) 내에서 이름 바꾸기(rename) 연산이 수행되므로, 파일 시스템 디바이스 이동 없이 순식간에 `fs.renameSync` 처리가 완료됩니다.

---

## 📝 상세 작업 목록 (Tasks)

1. `apps/viewer/src/api/routes/exporter.ts`에서 `tempExportDir`의 베이스 경로를 `/app/data/joplin/.tmp_export`로 수정합니다.
2. 수정 완료 후 재빌드 및 재시작하여 검증합니다.
3. 결과보고서(`.walkthrough.md`)를 작성하고 변경 이력을 자동 커밋합니다.
