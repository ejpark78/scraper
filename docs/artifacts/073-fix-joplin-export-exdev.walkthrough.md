# 🏁 결과보고서 (073-fix-joplin-export-exdev.walkthrough.md)

이 문서는 Joplin 내보내기 시 임시 경로(`/tmp`)와 실제 저장 경로(`/app/data/joplin`) 간의 파일 시스템 경계 이동 문제로 발생한 `EXDEV: cross-device link not permitted` 오류 해결 작업에 대한 변경 내용과 검증 결과를 기록합니다.

---

## 🛠️ 작업 내용 요약

1. **Joplin 내보내기 임시 디렉토리 경로 교체 (`apps/viewer/src/api/routes/exporter.ts`)**
   - **문제**: 컨테이너 루트 파일 시스템을 쓰는 임시 경로(`/tmp/joplin_export`)에서 호스트 볼륨이 마운트된 경로(`/app/data/joplin`)로 폴더를 이동(`fs.renameSync`)하려 할 때, 파일 시스템 경계 충돌(`EXDEV`)로 인해 내보내기 처리가 모두 실패했습니다.
   - **해결**: 임시 내보내기 디렉토리 경로를 실제 마운트 볼륨 내에 위치하는 `/app/data/joplin/.tmp_export`로 수정했습니다.
   - **결과**: 동일한 마운트 디스크 볼륨 내부에서 rename 연산이 수행되므로 파일 시스템 경계 충돌이 완전히 해결되었습니다.

---

## 🧪 검증 결과 및 확인 로그

1. **빌드 및 기동 확인**:
   - `make viewer-build && make viewer-up` 성공적으로 완료.
   - `viewer-api` 서버 및 프론트엔드가 정상 연결 확인 완료.
2. **동기화 재수행 결과**:
   - 동일 디스크 내부에서 폴더 교체가 실행되어 마크다운 내보내기 작업이 `EXDEV` 오류 없이 즉각적이고 부드럽게 완료되었습니다.

---

## 💡 종합 평가
- Docker 볼륨 마운트 구조상의 파일 시스템 바인딩 경계 문제를 성공적으로 완화하여, 안정적인 Joplin 내보내기 파이프라인을 최종 완성했습니다.
