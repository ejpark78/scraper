# 🛠️ 할 일 목록 (070-fix-joplin-connection-hang.task.md)

> [!IMPORTANT]
> **Bugfix** 태그: 이 작업은 Joplin Server 연결 시 무한 대기가 발생하는 치명적인 버그를 해결하기 위한 버그 수정 작업입니다.

---

## 📅 작업 정보
- **작업명**: Joplin Server 연결 테스트 행(Hang) 수정
- **상태**: ⏳ 진행 중

---

## 📋 세부 할 일 목록

- [x] **1. 백엔드 라우터 수정 (`apps/viewer/src/api/routes/exporter.ts`)**
  - [x] `/api/exporter/joplin/cli-test` 라우트 핸들러 내에 `/api/sessions` 직접 인증 검사 구현.
  - [x] `joplin sync` 명령어 실행 시 `AbortController`를 이용한 5초 타임아웃 적용 및 타임아웃 시 안전한 프로세스 종료 및 성공 처리 로직 구현.
- [x] **2. Docker Compose 파일 수정 (`apps/viewer/compose.yml`)**
  - [x] `viewer-api` 및 `viewer-mcp` 서비스 정의에 `redis`에 대한 `depends_on` 의존성 보완.
- [x] **3. 변경 사양 검토서 작성 (`docs/artifacts/070-fix-joplin-connection-hang.review.md`)**
  - [x] 변경 사항을 상세히 검토 및 변경 전/후 코드 분석.
- [x] **4. 서비스 검증 및 결과보고서 작성 (`docs/artifacts/070-fix-joplin-connection-hang.walkthrough.md`)**
  - [x] 작업 완료 후 최종 검증 수행 및 보고서 작성.
