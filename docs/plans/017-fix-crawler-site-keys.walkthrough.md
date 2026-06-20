# Walkthrough: 크롤러 사이트 키 불일치 오류 수정

이 문서는 작업 결과 보고서입니다.

## 1. 수정 내용 상세
- [SiteRegistry.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/core/SiteRegistry.ts#L159)에서 `getSite` 호출 시 파라미터 `key`가 `dailydoseofds`인 경우 `dailydose_ds`로 자동 보정하여 반환하도록 함으로써, `dailydoseofds` 키를 사용하는 모든 후속 CLI 동작이 오동작 없이 원활하게 작동하게 조치했습니다.
- [cli-list.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/cli-list.ts#L16)에서 `dailydose_ds` 경로 매핑 키를 `dailydoseofds`로 변경하고, `linkedin_jobs`를 `linkedin`으로 변경하여 빌드 컨테이너의 CLI 연동 규격에 맞추었습니다.

## 2. 검증 방법 안내
- 컨테이너 이미지를 재생성(`make rebuild`)한 후, `make list` 또는 `make ddds-list`를 수행하여 모든 수집 스크립트가 에러 없이 시작되는지 확인합니다.
