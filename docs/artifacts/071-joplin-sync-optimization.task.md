# 🛠️ 할 일 목록 (071-joplin-sync-optimization.task.md)

---

## 📅 작업 정보
- **작업명**: Joplin CLI 동기화 성능 개선 및 실시간 스트리밍 구현
- **상태**: ⏳ 진행 중

---

## 📋 세부 할 일 목록

- [x] **1. Joplin 영구 프로필 폴더 설정 및 라우터 수정 (`apps/viewer/src/api/routes/exporter.ts`)**
  - [x] Joplin CLI 실행 환경 변수의 `HOME`을 `/app/data/.joplin_profile`로 교체하고 자동 폴더 생성 추가.
  - [x] `/api/exporter/joplin/cli-sync/stream` POST 라우터 신설. (기존 cli-sync 라우터를 스트리밍으로 전면 개편 완료)
  - [x] `child_process.spawn`을 사용하여 동기화 진행 상황을 실시간 스트리밍 형태로 전송하는 로직 작성.
- [x] **2. 프론트엔드 연동 구현 (`apps/viewer/src/frontend/src/views/ExternalView.vue`)**
  - [x] `syncJoplinCli` 함수를 수정하여 `fetch`의 `ReadableStream`을 통해 청크 데이터를 실시간 파싱하고 로그 창에 동적으로 출력하도록 개선.
- [x] **3. 변경 사양 검토서 작성 (`docs/artifacts/071-joplin-sync-optimization.review.md`)**
  - [x] 코드 변경 전/후 검토 및 품질 확인.
- [x] **4. 서비스 검증 및 결과보고서 작성 (`docs/artifacts/071-joplin-sync-optimization.walkthrough.md`)**
  - [x] 동기화 기동 및 UI에서의 실시간 출력 검증 후 결과보고서 작성.
