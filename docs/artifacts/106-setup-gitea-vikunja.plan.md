# 로컬 Gitea 및 Vikunja 인프라 구축 계획서 (수정안 - macOS 호환성 반영)

이 계획서는 macOS 환경에서의 호환성 문제를 해결하기 위해 볼륨 마운트 구조를 재조정하고, 안전한 타임존 설정 방식으로 전환하는 내용을 다룹니다.

## User Review Required

> [!IMPORTANT]
> - **macOS 볼륨 마운트 오류 방지**: Gitea 컨테이너 설정에 포함된 `/etc/timezone` 및 `/etc/localtime` 볼륨 바인딩을 제거하고 환경변수 `TZ=Asia/Seoul`로만 타임존을 맞춥니다.
> - **마운트 경로 일관성**: 상대 경로 볼륨 매핑 시 컨테이너가 루트 `compose.yml` 기준으로 실행되므로, 상대 경로가 의도하지 않은 위치로 꼬이지 않도록 명확하게 마운트 디렉토리를 정의합니다.
>   - Gitea: `./docker/tools/gitea/data` 경로를 호스트 디렉토리로 매핑
>   - Vikunja: `./docker/tools/vikunja/data` 및 `./docker/tools/vikunja/db` 경로를 호스트 디렉토리로 매핑

## Open Questions

- Gitea의 데이터 디렉토리와 Vikunja의 데이터 디렉토리를 프로젝트 루트 하위의 `docker/tools/gitea/data` 및 `docker/tools/vikunja/data`에 생성하여 프로젝트 파일들과 섞이지 않도록 격리하려 합니다.

## Proposed Changes

### [Docker Infra & Tools Setup]

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/gitea/compose.yml)
- macOS에서 에러를 유발하는 `/etc/timezone` 및 `/etc/localtime` 볼륨 마운트 제거
- 볼륨 마운트 절대 경로 설정 및 안정성 확보를 위해 상대경로 매핑 위치를 `./docker/tools/gitea/data` 기반으로 구체화

#### [MODIFY] [compose.yml](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/compose.yml)
- Vikunja 볼륨 마운트 경로를 루트 기준 실행에 안전하도록 `./docker/tools/vikunja/data` 및 `./docker/tools/vikunja/db` 로 명시

---

## Verification Plan

### Manual Verification
1. Gitea 및 Vikunja 컴포즈 파일에 대한 설정 구문 검사:
   - `docker compose -f compose.yml config` (루트 기준 로드가 정상적으로 되고 볼륨 경로가 올바르게 보간되는지 확인)
2. 정상 구동 후 컨테이너 내부 타임존 및 `date` 명령 확인
