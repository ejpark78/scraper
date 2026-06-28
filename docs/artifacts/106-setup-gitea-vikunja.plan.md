# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - Traefik 라우팅 에러 보완)

이 계획서는 Traefik이 Gitea 및 Vikunja 컨테이너로 라우팅하지 못해 발생하는 404 에러를 수정하기 위해, 네트워크 통합 및 컴포즈 실행 종속성 설정을 보완하는 내용을 다룹니다.

## User Review Required

> [!IMPORTANT]
> - **Traefik 종속성 명시**:
>   - Gitea와 Vikunja 서비스에 `depends_on: traefik` 관계(조건: `service_healthy`)를 명시하여, 프록시망이 활성화된 후 트래픽 수신 준비가 끝난 시점에 두 서비스가 로드되도록 제어합니다.
> - **공용 네트워크 바인딩 명시**:
>   - `default` 컴포즈 네트워크에 대한 바인딩 정의를 보완하여 다른 인프라 컨테이너들과의 통신 단절을 방지합니다.

## Proposed Changes

### [Docker Tools Setup]

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/gitea/compose.yml)
- `depends_on` 추가:
  ```yaml
  depends_on:
    traefik:
      condition: service_healthy
  ```
- `networks` 정의 추가:
  ```yaml
  networks:
    default:
      aliases:
        - gitea.localhost
  ```

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/compose.yml)
- `depends_on` 추가:
  ```yaml
  depends_on:
    traefik:
      condition: service_healthy
  ```
- `networks` 정의 추가:
  ```yaml
  networks:
    default:
      aliases:
        - vikunja.localhost
  ```

---

## Verification Plan

### Manual Verification
1. 변경 사항 적용 후 전체 프로파일 도구 가동:
   - `docker compose -p scraper --profile tools up -d --force-recreate`
2. `docker compose -p scraper ps`를 통해 모든 컨테이너가 동일 네트워크에 정상 기동되었는지 상태 진단
3. 브라우저로 `https://gitea.localhost` 및 `https://vikunja.localhost` 접근하여 404가 해결되고 정상 로드되는지 검증
