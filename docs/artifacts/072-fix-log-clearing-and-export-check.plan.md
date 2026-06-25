# 📋 작업 계획서: Joplin 내보내기 로그 초기화 버그 해결 및 상세 에러 분석 (072-fix-log-clearing-and-export-check.plan.md)

이 문서는 Joplin CLI 동기화 완료 후 노트북 목록 로드 단계에서 이전 동기화/내보내기 로그가 완전히 삭제되어 상세 에러 내역을 확인할 수 없었던 프론트엔드 버그를 수정하고, 실제 내보내기 장애 요인을 추적하는 계획을 정의합니다.

---

## 1. 🔍 문제 원인 분석

1. **프론트엔드 로그 즉시 초기화 버그**:
   - `syncJoplinCli()` 동기화 프로세스 실행 중 일부 노트북 내보내기 실패 시 백엔드는 실시간 스트림으로 `writeLog('error', ...)` 메시지를 전달합니다.
   - 프론트엔드가 이를 로그창에 출력하지만, 동기화 프로세스가 성공 판정으로 완료된 직후 자동으로 `loadJoplinFolders()`를 호출합니다.
   - `loadJoplinFolders()` 함수 시작부에 `clearLog('import')`가 강제 정의되어 있어, **이전의 동기화 과정 로그 및 내보내기 에러 문구가 순식간에 지워지고** 노트북 로딩 완료 메시지만 남게 됩니다.

---

## 2. 🛠️ 해결 방안

### 개선 1: `loadJoplinFolders` 함수에 로그 유지 파라미터 추가
- `loadJoplinFolders(shouldClear = true)` 형태로 함수 서명을 변경합니다.
- `syncJoplinCli()` 종료 후 자동 새로고침 호출 시에는 `loadJoplinFolders(false)`를 전달하여, 이전 로그(특히 내보내기 실패 에러 메시지)가 화면에서 사라지지 않고 고스란히 남아있도록 수정합니다.

### 개선 2: 실제 에러 내역 파악 및 후속 조치
- 프론트엔드 로그 유지 패치 반영 후, 사용자가 다시 동기화를 눌러 표시되는 실시간 로그 에러를 직접 추적하여 추가 해결책을 수립합니다.

---

## 📝 상세 작업 목록 (Tasks)

1. `apps/viewer/src/frontend/src/views/ExternalView.vue` 파일의 `loadJoplinFolders` 수정 및 `syncJoplinCli` 호출 변경.
2. 프론트엔드 정적 파일 빌드 (`make viewer-build`).
3. 서비스 재기동 후 실시간 로그 유지 여부 확인 및 에러 메시지 검토.
4. 검토서 및 결과보고서 작성.
