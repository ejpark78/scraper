# Task List: GPTers 사이트 키 불일치 오류 수정

이 문서는 작업을 위해 할당된 타스크 목록과 진행 현황을 보관합니다.

- [x] 원인 분석 및 `cli-list.ts` 확인
- [x] 구현 계획 제안 및 사용자 승인 획득
- [x] `docs/plans/fix-gpters-site-key.md` 계획 문서 작성 및 저장
- [x] `apps/crawler/src/cli-list.ts` 코드 수정
  - `pathMap` 내 `gpters_news` -> `gpters` 변경
  - 조건문 내 `gpters_news` -> `gpters` 변경
- [x] 변경 사항 git commit
- [x] 코드 리뷰 세트 작성 (`.md`, `.task.md`, `.walkthrough.md`)
- [ ] 검증 명령어 사용자 안내 및 확인
