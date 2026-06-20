# Summary: 036-fix-meilisearch-and-mongo-makefile-paths

> Squashed from: 036-fix-meilisearch-and-mongo-makefile-paths.review.md 036-fix-meilisearch-and-mongo-makefile-paths.task.md 036-fix-meilisearch-and-mongo-makefile-paths.walkthrough.md

---

## Review

# 🔍 Code Review: Fix Meilisearch & MongoDB Makefile Scripts Paths

## 1. 개요
- **목적**: `make ms-reindex` 실행 시 컨테이너 경로 오지정으로 스크립트 실행이 불가하던 현상 해결 및 이전에 결정한 `WORKSPACE_MOUNT` 제거 정책 반영
- **유형**: Bugfix (버그 수정)

## 2. 변경 내용 및 자가 진입점 평가
- [meili.mk](file:///home/ejpark/workspace/scraper/scripts/utils/meili.mk#L7-L26)와 [mongo.mk](file:///home/ejpark/workspace/scraper/scripts/utils/mongo.mk#L35-L43)에서 컨테이너 내부 실행 경로에 중복 적용되었던 `apps/crawler/` 접두사를 지웠습니다.
- 컨테이너 내부 소스 코드는 빌드 시 `/app` 디렉터리에 복사되어 바로 하위에 `src`가 존재합니다.
- `mongo.mk` 내 `index` 명령어 실행 시 정의되지 않은 `viewer` 서비스 대신 `worker` 서비스를 타겟으로 실행하도록 변경했습니다.
- 두 파일 내 잔재되어 있던 `$(WORKSPACE_MOUNT)` 옵션을 모두 제거했습니다.

## 3. 평가
- **올바름(Correctness)**: 경로 오설정과 무효한 서비스명을 바로잡아, `make ms-reindex`가 정상 가동되도록 수정되었습니다.
- **가독성(Readability)**: 불필요한 마운트 변수가 사라져 한결 명료해졌습니다.
- **아키텍처(Architecture)**: [009-remove-workspace-mount](file:///home/ejpark/workspace/scraper/docs/artifacts/009-remove-workspace-mount.plan.md)에서 아키텍처 의사결정으로 지정한 "로컬 볼륨 마운트 제거 및 빌드된 온전한 이미지 형상 실행" 정책을 완전히 동기화했습니다.

---

## Task

# 📋 Task: Fix Meilisearch & MongoDB Makefile Scripts Paths

이 태스크 목록은 `make ms-reindex` 실행 문제 수정 과정을 기록 및 관리합니다.

## 할 일 목록
- [x] `scripts/utils/meili.mk` 파일에서 `$(WORKSPACE_MOUNT)` 제거 및 `apps/crawler/` 경로 접두사 제거
- [x] `scripts/utils/mongo.mk` 파일에서 `$(WORKSPACE_MOUNT)` 제거, `apps/crawler/` 경로 접두사 제거, `viewer` 서비스를 `worker`로 변경
- [x] 실행 오류 해결 여부 수동 검증 및 결과 확인
- [x] 코드 리뷰 문서 (`036-fix-meilisearch-and-mongo-makefile-paths.review.md`) 작성
- [x] 결과보고서 (`036-fix-meilisearch-and-mongo-makefile-paths.walkthrough.md`) 작성
- [x] 자동 커밋 스크립트 실행

---

## Walkthrough

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

---

