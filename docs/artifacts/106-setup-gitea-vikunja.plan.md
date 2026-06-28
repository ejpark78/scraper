# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - Gitea 초기 계정 자동 생성 Make 연동)

이 계획서는 `make up-gitea` 실행 단계에서 컨테이너 기동 후 관리자 계정 존재 여부를 확인하고, 미존재 시 `admin` / `admin12345` 계정을 자동으로 CLI를 통해 강제 생성하는 로직을 `tools.mk`에 바인딩하는 계획을 다룹니다.

## Proposed Changes

### [Developer Tooling Setup]

#### [MODIFY] [tools.mk](file:///Users/ejpark/workspace/scraper/scripts/tools/tools.mk)
- `up-gitea` 타겟 명령어 확장:
  - 컨테이너 백그라운드 기동 후 Gitea 준비 상태를 위해 3초 대기
  - `gitea admin user list`를 수행하여 사용자 목록이 비어 있거나 `admin`이 없으면 `gitea admin user create` 명령어로 `admin` / `admin12345` 계정 자동 생성 수행

---

## Verification Plan

### Manual Verification
1. `make up-gitea` 실행 후, 추가 터미널 조작 없이 즉시 `https://gitea.localhost/` 에서 `admin` / `admin12345`로 로그인 되는지 확인
