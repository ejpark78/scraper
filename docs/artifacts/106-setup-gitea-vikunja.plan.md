# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - Makefile 단축 타겟 추가)

이 계획서는 Gitea와 Vikunja 컨테이너의 신속한 기동 및 관리를 위해 `scripts/tools/tools.mk` 파일에 단축 Makefile 타겟(`up-gitea`, `up-vikunja`)을 추가하는 설정을 다룹니다.

## Proposed Changes

### [Developer Tooling Setup]

#### [MODIFY] [tools.mk](file:///Users/ejpark/workspace/scraper/scripts/tools/tools.mk)
- `up-gitea` 타겟 추가:
  - `docker compose -p scraper --profile tools up -d --force-recreate gitea` 명령어 바인딩
- `up-vikunja` 타겟 추가:
  - `docker compose -p scraper --profile tools up -d --force-recreate vikunja` 명령어 바인딩

---

## Verification Plan

### Manual Verification
1. `make up-gitea` 명령어 실행이 에러 없이 호출되는지 테스트
2. `make up-vikunja` 명령어 실행이 에러 없이 호출되는지 테스트
