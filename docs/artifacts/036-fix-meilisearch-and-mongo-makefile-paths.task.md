# 📋 Task: Fix Meilisearch & MongoDB Makefile Scripts Paths

이 태스크 목록은 `make ms-reindex` 실행 문제 수정 과정을 기록 및 관리합니다.

## 할 일 목록
- [x] `scripts/utils/meili.mk` 파일에서 `$(WORKSPACE_MOUNT)` 제거 및 `apps/crawler/` 경로 접두사 제거
- [x] `scripts/utils/mongo.mk` 파일에서 `$(WORKSPACE_MOUNT)` 제거, `apps/crawler/` 경로 접두사 제거, `viewer` 서비스를 `worker`로 변경
- [x] 실행 오류 해결 여부 수동 검증 및 결과 확인
- [x] 코드 리뷰 문서 (`036-fix-meilisearch-and-mongo-makefile-paths.review.md`) 작성
- [x] 결과보고서 (`036-fix-meilisearch-and-mongo-makefile-paths.walkthrough.md`) 작성
- [ ] 자동 커밋 스크립트 실행
