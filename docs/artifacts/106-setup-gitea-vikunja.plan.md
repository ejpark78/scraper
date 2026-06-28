# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - Gitea 자동 계정 생성 추가)

이 계획서는 Gitea 컨테이너 구동 시 초기 관리자(Admin) 계정을 수동 가입 없이 환경 변수를 통해 자동으로 프로비저닝(Provisioning)하는 설정을 추가하는 계획을 다룹니다.

## User Review Required

> [!IMPORTANT]
> - **보안 설정 및 자동 계정 생성**:
>   - `INSTALL_LOCK=true`를 설정하여 초기 설정 화면 진입 단계를 생략합니다.
>   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` 설정을 주입하여 컨테이너 생성 시 관리자 계정을 자동으로 생성합니다.
>   - 기본 비밀번호(예: `admin12345`)는 임시로 지정해 두었으며 첫 로그인 후 원하시는 값으로 변경을 권장합니다.

## Proposed Changes

### [Docker Tools Setup]

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/gitea/compose.yml)
- Gitea 서비스의 `environment` 목록에 초기 계정 자동 생성용 보안 설정 추가:
  - `GITEA__security__INSTALL_LOCK=true`
  - `GITEA__security__ADMIN_USERNAME=admin`
  - `GITEA__security__ADMIN_PASSWORD=admin12345`
  - `GITEA__security__ADMIN_EMAIL=admin@example.com`

---

## Verification Plan

### Manual Verification
1. 설정 완료 후 컴포즈 컨테이너 재생성 구동:
   - `docker compose -p scraper --profile tools up -d --force-recreate gitea`
2. `https://gitea.localhost` 웹 브라우저 접속 후 `admin` / `admin12345` 계정으로 즉시 로그인 되는지 체크
