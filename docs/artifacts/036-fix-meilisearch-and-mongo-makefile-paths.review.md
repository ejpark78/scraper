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
