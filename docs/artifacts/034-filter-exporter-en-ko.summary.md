# Summary: 034-filter-exporter-en-ko

> Squashed from: 034-filter-exporter-en-ko.review.md 034-filter-exporter-en-ko.task.md 034-filter-exporter-en-ko.walkthrough.md

---

## Review

# Review - Filter Exporter Chapters (en-ko)

## 1. 코드 변경 내용 검토
- **대상 파일**: `apps/viewer/src/exporter/utils/fileLoader.ts`
- **구현 내용**:
  - `loadBookFromDirectory` 함수가 실행될 때, 디렉터리 내의 모든 마크다운 파일(`.md`)을 가져옵니다.
  - 이 중 `.en-ko.md`로 끝나는 파일이 존재하는지 검사하고, 해당 파일들의 베이스 네임을 맵(`hasEnKo`)에 등록합니다.
  - 마크다운 파일 목록을 필터링할 때, 만약 일반 `.md` 파일의 베이스 네임이 `hasEnKo` 맵에 존재하면 해당 파일을 배제합니다.
  - 이를 통해 동일한 챕터에 번역본과 원본이 공존할 때 번역본만 선택되어 내보내지게 됩니다.

## 2. 자가 검증 (Self-Inspection)
- **정확성**:
  - `1. Introduction What Is Vibe Coding.en-ko.md`와 `1. Introduction What Is Vibe Coding.md`가 같이 있을 때, `hasEnKo` 맵에는 `1. introduction what is vibe coding`이 기록되며, 필터링 로직에 의해 후자는 제거되고 전자는 포함됩니다.
  - 번역본이 존재하지 않는 `2. Another Chapter.md`인 경우에는 베이스 네임이 `hasEnKo`에 존재하지 않으므로 그대로 유지됩니다.
- **예외 처리 및 성능**:
  - `Set`을 사용하여 조회 속도가 $O(1)$로 유지됩니다.
  - 파일명을 소문자(`toLowerCase()`)로 정규화하여 비교하므로 대소문자 차이로 인한 매칭 실패를 미연에 방지합니다.
- **의존성 영향**:
  - `listAvailableBooks` 등 다른 함수에는 아무런 영향을 주지 않습니다.

---

## Task

# Task - Filter Exporter Chapters (en-ko)

- [x] `apps/viewer/src/exporter/utils/fileLoader.ts` 내의 `loadBookFromDirectory` 함수 수정
- [x] 로컬/도커 환경 등에서 기능 검증 및 테스트 진행
- [x] 코드 리뷰 및 결과 보고서 작성


---

## Walkthrough

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

---

