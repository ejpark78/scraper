# Plan: add-crawler-profile

`apps/crawler/docker/worker/compose.yml` 파일 내에 정의된 크롤러 관련 서비스들에 `crawler` 프로필(profile)을 추가하는 계획입니다.

## User Review Required
> [!IMPORTANT]
> - `worker`, `scraper`, `converter`, `indexer` 서비스에 `crawler` 프로필을 추가하여, `docker compose --profile crawler up` 형태로 크롤러 핵심 서비스 그룹을 일괄 실행하거나 관리할 수 있도록 합니다.

## Proposed Changes

### Docker Compose Configuration
- **`[MODIFY]`** `apps/crawler/docker/worker/compose.yml`:
  - `worker` 서비스의 profiles 항목 아래에 `- crawler` 추가
  - `scraper` 서비스의 profiles 항목 아래에 `- crawler` 추가
  - `converter` 서비스의 profiles 항목 아래에 `- crawler` 추가
  - `indexer` 서비스의 profiles 항목 아래에 `- crawler` 추가

---

## Verification Plan

### Manual Verification
- 파일 변경 후 문법적 이상 유무 확인:
  - `docker compose -f apps/crawler/docker/worker/compose.yml config` 명령어를 통해 프로필 추가 설정이 올바르게 분석되는지 확인합니다.
