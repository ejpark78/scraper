# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - networks 블록 제거)

이 계획서는 Docker Compose 기본 default 네트워크를 공유하여 연동되므로 컴포즈 파일 내에서 불필요한 `networks` 에일리어스 정의 블록들을 일괄 제거하여 설정을 경량화하고 직관적으로 관리하기 위한 수정 사항을 다룹니다.

## User Review Required

> [!IMPORTANT]
> - **불필요한 네트워크 설정 간소화**:
>   - Gitea(`docker/tools/gitea/compose.yml`) 및 Vikunja(`docker/tools/vikunja/compose.yml`) 컴포즈 파일 내의 `networks` 및 하위 `default.aliases` 설정 영역을 제거합니다.
>   - 이를 통해 에러 가능성을 낮추고, 기존 인프라망 구조에 맞춰 간결하게 유지되도록 합니다.

## Proposed Changes

### [Docker Tools Setup]

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/gitea/compose.yml)
- `networks` 관련 블록 제거

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/compose.yml)
- `networks` 관련 블록 제거

---

## Verification Plan

### Manual Verification
1. 변경 사항 적용 후 전체 프로파일 도구 가동:
   - `docker compose -p scraper --profile tools up -d --force-recreate`
2. 브라우저로 `https://gitea.localhost` 및 `https://vikunja.localhost` 접근하여 404 없이 정상 로드되는지 최종 검증
