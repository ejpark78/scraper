# Task List: apps/exporter 통합 및 Joplin/Obsidian 내보내기 이식

본 문서는 `apps/exporter` 이식 작업의 단계별 수행 내역을 기록하는 할 일 목록 보존 문서입니다.

## 🏁 진행 상태 요약
- **시작일**: 2026-06-20
- **상태**: 완료 (Completed)

---

## 📝 상세 할 일 및 수행 완료 여부

- [x] 1단계: 마이그레이션 계획서 작성 및 승인 받기
  - [x] `docs/plans/0001-integrate-joplin-obsidian-exporter.md` 작성 완료 및 승인 완료
- [x] 2단계: `apps/exporter` 기본 구조 설정
  - [x] `package.json` 신규 작성 및 의존성 정의
  - [x] `tsconfig.json` 신규 작성
- [x] 3단계: 도커 실행 환경 설정
  - [x] `Dockerfile` 작성 (의존성 로드 및 ts 빌드 설정)
  - [x] `compose.yml` 작성 (로컬 볼륨 마운트 및 scraper_default 네트워크 연동)
  - [x] `Makefile` 작성 (build, run, shell 명령어 단축 키바인딩 제공)
- [x] 4단계: 소스코드 이식 및 구현
  - [x] `src/types/index.ts` 타입 설정
  - [x] `src/export/base.ts` 파일명 sanitize 헬퍼 포팅
  - [x] `src/generators/index.ts` INDEX.md 포매터 구현
  - [x] `src/export/joplin.ts` Joplin API 연동 및 노트 업로더 포팅
  - [x] `src/export/obsidian.ts` Obsidian REST API 연동 및 파일 업로더 포팅
  - [x] `src/utils/fileLoader.ts` 로컬 마크다운 디렉터리 로더 구현
  - [x] `src/index.ts` CLI 인자 파서 및 제어기 포팅
- [x] 5단계: 빌드 및 헬프 가이드 동작 테스트
  - [x] `docker compose build` 에러 디버깅 및 수정 (`npm ci` -> `npm install` 패키지락 예외 조치)
  - [x] `--help` 인자 입력 시 CLI 도움말 메시지 정상 출력 확인
- [x] 6단계: 문서화 수명 주기 보존
  - [x] 코드 리뷰(`0001-integrate-joplin-obsidian-exporter.md`) 작성
  - [x] 결과보고서(`0001-integrate-joplin-obsidian-exporter.walkthrough.md`) 작성
  - [x] 루트 `CHANGELOG.md` 업데이트
