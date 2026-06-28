# 로컬 Gitea 및 Vikunja 인프라 구축 계획서

이 계획서는 외부 SaaS 의존성을 제거하고, Docker Compose 환경 하에 로컬 Git 미러링/호스팅 서비스인 **Gitea**와 프로젝트/이슈/일정 관리 시스템인 **Vikunja**를 독립 실행하는 구축 계획을 다룹니다.

## User Review Required

> [!IMPORTANT]
> - **네트워크 및 프록시 설정**: 기존 `docker/infra/traefik/`에 구성된 역방향 프록시(Traefik) 네트워크(`traefik-public` 또는 내부망 명칭)를 연동하여 도메인 경유 접속을 지원하도록 구성합니다.
> - **데이터 영속성 보장**: 컨테이너가 내려가도 데이터가 보존되도록 로컬 호스트 볼륨 바인딩(예: `./data/` 하위 경로)을 안전하게 지정합니다.
> - **리소스 관리**: Vikunja와 Gitea는 Go 언어 기반으로 매우 경량이지만, 데이터베이스(PostgreSQL, Redis 등)가 포함되므로 개발 장비에 부담을 최소화하는 구조로 설계합니다.

## Open Questions

- 기존 Traefik 구성이 프록시 허용하고 있는 로컬 개발용 서브도메인이 있는지 확인이 필요합니다 (예: `*.localhost` 또는 `gitea.localhost`, `vikunja.localhost`).

## Proposed Changes

### [Docker Infra & Tools Setup]

기존 모노레포의 `docker/tools/` 하위에 각각 서비스를 배치합니다.

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/compose.yml)
- `include` 지시자 목록에 `docker/tools/gitea/compose.yml` 및 `docker/tools/vikunja/compose.yml` 추가

#### [NEW] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/gitea/compose.yml)
- Gitea 서비스 단독 구성 (SQLite3 기반)
- 외부 Traefik 라우팅을 위한 Label 지정 및 `scraper_network` 연결
- Gitea 볼륨 매핑 (`./data/gitea`)

#### [NEW] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/compose.yml)
- Vikunja API 서버 및 Frontend 통합 구성 (SQLite3 데이터베이스 적용)
- Vikunja 백그라운드 태스크 처리를 위한 구성
- 외부 Traefik 라우팅을 위한 Label 지정 및 `scraper_network` 연결
- Vikunja 볼륨 매핑 (`./data/vikunja`)

#### [MODIFY] [INDEX.md](file:///Users/ejpark/workspace/scraper/docs/artifacts/INDEX.md)
- `106-setup-gitea-vikunja` 아티팩트 항목을 색인 문서에 추가합니다.

---

## Verification Plan

### Manual Verification
1. Docker Compose 명령어로 각 툴 빌드 및 백그라운드 가동 확인
   - `docker compose -f docker/tools/gitea/compose.yml up -d`
   - `docker compose -f docker/tools/vikunja/compose.yml up -d`
2. Traefik 라우팅 또는 로컬 포트를 통한 웹 콘솔 정상 접근 확인
3. Gitea에서 GitHub Repo Mirroring 정상 동작 여부 체크
4. Vikunja 로그인 및 칸반 보드 생성 테스트
