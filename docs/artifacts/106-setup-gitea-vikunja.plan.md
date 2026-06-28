# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - USER 0 지정을 통한 빌드 복구)

이 계획서는 Vikunja 이미지 빌드 도중 발생하는 `unable to find user root` 오류를 해결하기 위해, 빌드 명세의 root 사용자를 UID 0으로 선언하여 curl 설치 및 헬스체크를 정상 완결하는 조치를 다룹니다.

## Proposed Changes

### [Docker Tools Setup]

#### [MODIFY] [Dockerfile](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/Dockerfile)
- `USER root` ➡️ `USER 0`으로 변경하여 빌드 권한 맵 매핑 에러 해결

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/compose.yml)
- `build` 및 `local/vikunja:latest` 빌드 이미지 매핑 복원
- `healthcheck` 블록 복원 (curl 기반 헬스 확인 수행)

---

## Verification Plan

### Manual Verification
1. `make up-vikunja` 실행 시 에러 없이 커스텀 curl 이미지가 빌드되는지 확인
2. `docker compose -p scraper ps` 결과 상 `healthy` 상태 점검
3. `https://vikunja.localhost/` 최종 브라우저 접속 확인
