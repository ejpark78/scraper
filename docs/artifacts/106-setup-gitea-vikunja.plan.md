# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - Vikunja 헬스체크 오류 수정)

이 계획서는 Vikunja 컨테이너 내부의 `wget` 명령어 누락으로 인한 Unhealthy 루프 및 Traefik 라우팅 404 차단 현상을 해결하기 위해 헬스체크 방식을 교정하는 조치를 다룹니다.

## Proposed Changes

### [Docker Tools Setup]

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/compose.yml)
- 헬스체크 명령 수정:
  - 기존: `["CMD", "wget", "--spider", "-q", "http://localhost:3456/api/v1/info"]`
  - 변경: `["CMD", "curl", "-f", "http://localhost:3456/api/v1/info"]`

---

## Verification Plan

### Manual Verification
1. `make up-vikunja` 컨테이너 재생성 구동
2. `docker compose -p scraper ps`를 실행하여 `scraper-vikunja-1` 컨테이너가 `healthy` 상태로 전환되는지 확인
3. `https://vikunja.localhost/` 웹 브라우저 최종 접속 성공 여부 체크
