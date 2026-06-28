# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - networks 명시적 공유 지정)

이 계획서는 Traefik이 Gitea 및 Vikunja 서비스 컨테이너를 완벽히 인지하여 라우팅할 수 있도록, 각 컴포즈 파일에 디폴트 네트워크 바인딩 명시를 보완하는 설정을 다룹니다.

## User Review Required

> [!IMPORTANT]
> - **명시적 기본 네트워크 소속 지정**:
>   - Gitea(`docker/tools/gitea/compose.yml`) 및 Vikunja(`docker/tools/vikunja/compose.yml`)에 `networks: [default]`(또는 networks 하위 default 지정)을 선언하여 Traefik과 완전히 동일한 브릿지 네트워크 도메인을 확보합니다.

## Proposed Changes

### [Docker Tools Setup]

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/gitea/compose.yml)
- `networks` 정의 명시 추가:
  ```yaml
  networks:
    - default
  ```

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/compose.yml)
- `networks` 정의 명시 추가:
  ```yaml
  networks:
    - default
  ```

---

## Verification Plan

### Manual Verification
1. `make up-gitea` 및 `make up-vikunja` 구동 후
2. `https://gitea.localhost` 웹 브라우저 접속하여 404 에러가 해결되고 로그인 홈 화면이 표시되는지 최종 확인
