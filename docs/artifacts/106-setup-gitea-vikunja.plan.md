# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - Gitea 버전 업그레이드)

이 계획서는 Gitea의 버전을 오래된 구버전(`1.21.11`)에서 최신 공식 안정 릴리즈(`1.26-rootless`)로 상향 조정하여 도구의 보안 및 성능 안정성을 정비하는 조치를 다룹니다.

## Proposed Changes

### [Docker Tools Setup]

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/gitea/compose.yml)
- 이미지 태그 갱신:
  - 기존: `gitea/gitea:1.21.11-rootless`
  - 변경: `gitea/gitea:1.26-rootless`

---

## Verification Plan

### Manual Verification
1. `make up-gitea` 실행 시 1.26 버전의 이미지를 풀하고 가동 확인
2. `https://gitea.localhost/` 최종 브라우저 접속 및 로그인 동작 확인
