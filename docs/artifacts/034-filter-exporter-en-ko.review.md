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
