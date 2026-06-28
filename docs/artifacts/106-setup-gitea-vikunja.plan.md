# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - Redis 볼륨 표준 매칭)

이 계획서는 프로젝트 인프라 표준 방식에 맞춰 Gitea 및 Vikunja의 볼륨 마운트 경로를 `${HOST_PROJECT_PATH:-.}/data/.services/...` 구조로 일원화하는 내용을 다룹니다.

## User Review Required

> [!IMPORTANT]
> - **볼륨 마운트 경로 표준화**: 다른 인프라 서비스(Redis 등)와의 일관성을 확보하기 위해, 마운트 경로에 `${HOST_PROJECT_PATH:-.}` 환경변수를 적용하고 `data/.services/` 하위 폴더로 모읍니다.
>   - Gitea 데이터 경로: `${HOST_PROJECT_PATH:-.}/data/.services/gitea:/data`
>   - Vikunja 파일 경로: `${HOST_PROJECT_PATH:-.}/data/.services/vikunja/files:/app/vikunja/files`
>   - Vikunja DB 경로: `${HOST_PROJECT_PATH:-.}/data/.services/vikunja/db:/db`

## Proposed Changes

### [Docker Tools Setup]

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/gitea/compose.yml)
- 볼륨 마운트 경로를 `${HOST_PROJECT_PATH:-.}/data/.services/gitea:/data` 로 수정합니다.

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/compose.yml)
- 볼륨 마운트 경로를 `${HOST_PROJECT_PATH:-.}/data/.services/vikunja/files:/app/vikunja/files` 및 `${HOST_PROJECT_PATH:-.}/data/.services/vikunja/db:/db` 로 수정합니다.

---

## Verification Plan

### Manual Verification
1. Docker Compose 구문 확인 (`docker compose config`를 실행하여 컴포즈 파싱 에러 유무 진단)
2. 볼륨 마운트 경로에 실제 호스트 디렉토리가 바인딩되어 데이터 파일이 정상 생성되는지 검증
