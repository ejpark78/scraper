# Code Review: Viewer Up Docker Config 수정

본 코드 리뷰는 `make viewer-up` 실행 실패 이슈 해결을 위한 설정 파일(`apps/viewer/Makefile`)의 변경 내역을 검토합니다.

## Review Summary
- **Target File**: `apps/viewer/Makefile`
- **Goal**: `COMPOSE` 구문 내 다중 파일 지정으로 인한 Docker Compose v2 `include` 파싱 오류 제거 및 설정 단순화.
- **Result**: 루트 `compose.yml`만 타겟으로 잡아, 해당 파일의 `include`에 등록된 `apps/viewer/compose.yml`이 정상 결합되도록 함.

## Checklist
- [x] **No Host Port Access**: 변경 사항은 Docker 호스트 포트 노출과 무관합니다.
- [x] **Docker Network Usage**: Docker Compose의 실행 구성 및 프로젝트 디렉토리 경로 지정 방식을 개선하여 인프라 연동이 올바르게 맺어지도록 했습니다.
- [x] **Clean Setup**: 중복 포함된 `-f compose.yml`을 배제하여 Docker Compose v2 설정의 일관성을 높였습니다.

## Detailed Review

### apps/viewer/Makefile
```diff
 # Fallbacks for variables if not called from root Makefile
-COMPOSE ?= docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml -f compose.yml
+COMPOSE ?= docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml
```
- **의견**: 루트 `compose.yml`의 `include` 구문에서 이미 `apps/viewer/compose.yml`을 상대 경로로 가져오므로, `-f compose.yml`을 추가로 지정하면 Docker Compose가 작업 디렉토리를 머지하는 과정에서 하위의 종속성(`traefik` 등)을 누락시키는 버그를 완벽하게 회피하게 됩니다.
