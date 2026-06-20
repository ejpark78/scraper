# 🏁 Walkthrough: Fix LinkedIn List Scraper Argument Handling

이 문서는 LinkedIn List Scraper의 에러 현상 개선 조치 결과를 담고 있습니다.

## 1. 완료된 작업
- `apps/crawler/src/sites/linkedin/jobs/List.ts`의 메인 실행부 수정
  - 인자 값으로 숫자가 들어오면, 기본 설정 파일 경로인 `'config/config.json'`을 로드하도록 복구 로직 적용
- `docs/artifacts/` 디렉터리에 설계 및 리뷰 세트 문서 작성 완료
  - `035-fix-linkedin-list-argument.plan.md`
  - `035-fix-linkedin-list-argument.task.md`
  - `035-fix-linkedin-list-argument.review.md`

## 2. 검증 방법 안내
- 사용자는 호스트 환경 혹은 docker compose 환경에서 다음 명령어를 실행하여 검증을 시도할 수 있습니다.
  ```bash
  make li-list
  ```
- 비로그인 모드로 동작하며, 치명적인 오류 없이 "총 X 개의 목록 URL이 감지되었습니다."로 진행되는지 확인합니다.
