# Plan: move-ebook-docker-configs

`apps/crawler/docker/worker/` 하위에 위치하던 `ebook` 서비스의 Dockerfile 및 docker-compose 설정을 `apps/ebook/docker/` 디렉토리 하위로 이동하고, 이에 따라 볼륨 및 빌드 컨텍스트 경로를 알맞게 조정하는 계획입니다.

## User Review Required
> [!IMPORTANT]
> - 기존 `apps/crawler/docker/worker/compose.yml`의 `ebook` 서비스 설정이 삭제되고, `apps/ebook/docker/compose.yml`로 완전히 격리 분리됩니다.
> - `apps/ebook/docker/Dockerfile`은 루트 컨텍스트에서 빌드하는 사양이 유지되도록 경로가 패치됩니다.

## Proposed Changes

### 1. Ebook Service Configurations
- **`[NEW]`** `apps/ebook/docker/Dockerfile`: 기존 `apps/crawler/docker/worker/ebook/Dockerfile`을 복사/이관
- **`[NEW]`** `apps/ebook/docker/compose.yml`: 신규 compose 파일 생성 및 `ebook` 서비스 구성 정의 (빌드 컨텍스트 및 볼륨 마운트 경로 재조정)
- **`[DELETE]`** `apps/crawler/docker/worker/ebook/Dockerfile`: 기존 레거시 Dockerfile 제거
- **`[MODIFY]`** `apps/crawler/docker/worker/compose.yml`: 기존 `ebook` 서비스 정의 블록 삭제

---

## Verification Plan

### Manual Verification
- docker compose config 유효성 검사:
  - `docker compose -f apps/ebook/docker/compose.yml config` 명령어가 구문 오류 없이 정상적으로 실행되는지 확인합니다.
