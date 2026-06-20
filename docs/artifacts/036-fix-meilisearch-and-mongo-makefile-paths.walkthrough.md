# 🏁 Walkthrough: Fix Meilisearch & MongoDB Makefile Scripts Paths

이 문서는 Meilisearch 및 MongoDB 인덱스 관련 스크립트 실행 오류 해결 결과를 담고 있습니다.

## 1. 완료된 작업
- `scripts/utils/meili.mk` 및 `scripts/utils/mongo.mk` 변경 사항 적용
  - 컨테이너 내부 실행 명령어에 포함된 불필요한 `apps/crawler/` 경로 접두사 삭제 (`src/scripts/...`로 복구)
  - `$(WORKSPACE_MOUNT)` 옵션 잔재를 완전히 배제
  - `mongo.mk` 내부의 정의되지 않은 서비스 `viewer`를 `worker`로 교정
- 설계 및 리뷰 문서화 세트 마련

## 2. 검증 방법 안내
- 사용자는 다음 명령어를 실행하여 런타임 검증을 시도할 수 있습니다:
  ```bash
  make ms-reindex SITE=linkedin
  ```
- 에러 없이 Meilisearch 인덱스 재지정이 올바르게 구동되는지 확인합니다.
