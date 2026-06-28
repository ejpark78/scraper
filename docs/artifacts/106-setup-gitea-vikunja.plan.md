# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - Gitea 계정명 교체)

이 계획서는 Gitea 자체 예약어 제한에 따라 `admin` 아이디를 사용할 수 없는 문제를 해결하기 위해, 초기 관리자 계정명을 `gitea-admin`으로 변경 적용하는 내용을 다룹니다.

## Proposed Changes

### [Developer Tooling Setup]

#### [MODIFY] [tools.mk](file:///Users/ejpark/workspace/scraper/scripts/tools/tools.mk)
- `up-gitea` 내 자동 계정 생성 로직 수정:
  - 계정 감지 및 생성 기준명을 `admin` ➡️ `gitea-admin`으로 교체
  - 생성 명령어: `--username gitea-admin --password admin12345`

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/gitea/compose.yml)
- 환경변수의 `ADMIN_USERNAME` 값을 `gitea-admin`으로 통일

---

## Verification Plan

### Manual Verification
1. `make up-gitea` 재시행 시 오류 없이 `gitea-admin` 계정이 성공적으로 등록되는지 검증
2. 브라우저 로그인 화면에서 `gitea-admin` / `admin12345` 로 로그인 테스트
