# Walkthrough: GPTers 사이트 키 불일치 오류 수정

이 문서는 작업 결과 보고서입니다.

## 1. 수정 내용 상세
- [cli-list.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/cli-list.ts#L18)에서 `gpters_news`로 선언되어 있던 키를 `gpters`로 수정하여 `gpters/news/site.config.ts` 및 Makefile, `package.json`의 호출 설정과 통일했습니다.
- [cli-list.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/cli-list.ts#L63)의 수집 제한 처리 분기 조건문에서 `gpters_news` 키 대신 `gpters` 키를 식별하도록 변경했습니다.

## 2. 검증 방법 안내
- 사용자는 `make list` 또는 개별 `make gpt-list` 명령을 실행하여 오류 없이 수집이 정상 시작되는지 검증할 수 있습니다.
