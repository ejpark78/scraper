# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - Vikunja 최신화 및 Dockerfile 빌드)

이 계획서는 Vikunja의 버전을 최신 공식 릴리즈(`latest`)로 올리면서, 컨테이너 내부에 `curl`이 없어 발생하는 헬스체크 오류를 완치하기 위해 전용 Dockerfile을 빌드하여 가동하는 조치를 다룹니다.

## Proposed Changes

### [Docker Tools Setup]

#### [NEW] [Dockerfile](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/Dockerfile)
- 최신 공식 이미지(`FROM vikunja/vikunja:latest`)를 기반으로 하고, 헬스체크가 정상 수행될 수 있도록 `curl` 패키지를 설치하는 빌드 정의 파일 생성

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/compose.yml)
- `image: vikunja/vikunja:0.24.2` 대신 `build` 속성을 활용해 로컬 `Dockerfile` 경로 지정
- `image: local/vikunja:latest` 로 자체 이미지 태그 정의

---

## Verification Plan

### Manual Verification
1. `make up-vikunja` 시 `--build` 옵션을 결합해 빌드 가동
2. `docker compose -p scraper ps` 결과 상 `healthy` 상태로의 전입 유무 점검
3. `https://vikunja.localhost/` 최종 브라우저 접속 확인
