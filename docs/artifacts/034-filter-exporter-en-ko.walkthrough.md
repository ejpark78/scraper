# Walkthrough - Filter Exporter Chapters (en-ko)

동일한 챕터에 대해 번역본(`.en-ko.md`)과 원본(`.md`)이 혼재할 때, 번역본(`.en-ko.md`) 파일만 선택하여 내보내는 기능 구현 결과 보고서입니다.

## 1. 구현 요약
- 수정 대상: `apps/viewer/src/exporter/utils/fileLoader.ts`
- 수정 함수: `loadBookFromDirectory`
- 변경 내용:
  - 읽어들인 전체 `.md` 파일들 중에서 접미사가 `.en-ko.md`인 파일이 있을 때, 해당 파일의 베이스 파일명(대소문자 무관 비교를 위해 소문자화)을 수집합니다.
  - 전체 파일 목록을 필터링하여, 베이스 파일명이 번역본 파일 리스트에 존재하는 일반 `.md` 파일은 제외시킵니다.
  - 챕터 파일 정렬 과정은 기존과 동일하게 사전순(사전 기반 숫자 지원 정렬)으로 수행됩니다.

## 2. 권장 실행 및 확인 방법
- 수정한 백엔드 로직을 반영하기 위해, 프로젝트 규칙 11번(Pair Programming)에 따라 사용자가 수동으로 컨테이너를 빌드하고 서비스를 실행하는 것을 권장합니다.
- 다음 명령어를 수행하여 뷰어 서비스를 다시 시작하고 빌드할 수 있습니다:
  ```bash
  # 뷰어 서비스 빌드 및 재실행
  docker compose build viewer && docker compose up -d viewer
  ```
