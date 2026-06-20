# Summary: 013-fix-viewer-up-docker-config

> Squashed from: 013-fix-viewer-up-docker-config.review.md 013-fix-viewer-up-docker-config.task.md 013-fix-viewer-up-docker-config.walkthrough.md

---

## Review

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
+COMPOSE := docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml
```
- **의견**: 루트 `compose.yml`의 `include` 구문에서 이미 `apps/viewer/compose.yml`을 상대 경로로 가져오므로, `-f compose.yml`을 추가로 지정하면 Docker Compose가 작업 디렉토리를 머지하는 과정에서 하위의 종속성(`traefik` 등)을 누락시키는 버그를 완벽하게 회피하게 됩니다. 추가적으로 상위 `Makefile`에서 `COMPOSE`를 `export`하기 때문에 조건부 대입(`?=`) 대신 강제 대입(`:=`)을 사용하여 확실하게 덮어쓰도록 했습니다.

---

## Task

# Task: Viewer Up Docker Config 수정 작업

`make viewer-up` 실행 에러 관련 할 일 목록 및 진행 상태 기록입니다.

- [x] 원인 분석 및 `apps/viewer/Makefile`의 `COMPOSE` 다중 파일 빌드 지정 에러 확인
- [x] 변경 계획 제안 및 사용자 승인 획득
- [x] `docs/plans/fix-viewer-up-docker-config.md` 계획서 작성
- [x] `apps/viewer/Makefile` 내 `COMPOSE` 구문 수정
- [x] `docs/reviews/fix-viewer-up-docker-config.md` 코드 리뷰 작성
- [x] `docs/reviews/fix-viewer-up-docker-config.walkthrough.md` 결과 보고서 작성

---

## Walkthrough

# Walkthrough: Viewer Up Docker Config 수정 결과 보고서

## 작업 결과 요약
- `apps/viewer/Makefile`의 `COMPOSE` 구문에서 중복 지정되어 `include` 블록의 올바른 병합을 방해하던 `-f compose.yml` 플래그를 제거하였습니다.
- 추가로 부모 Makefile에서 `export COMPOSE`되는 값이 우선 처리되는 것을 막기 위해 `COMPOSE ?=` 대신 `COMPOSE :=` 강제 대입 연산자를 사용하도록 설정했습니다.
- 이로 인해 루트의 `compose.yml`이 정상 파싱되고, `include`된 `traefik`, `mongodb`, `redis` 등 인프라 서비스와 `viewer` 서비스들이 온전하게 인식됩니다.

## 변경 파일
- `[MODIFY]` [apps/viewer/Makefile](file:///home/ejpark/workspace/scraper/apps/viewer/Makefile)

## 검증 결과
- 수정 후 `make viewer-up` 실행 시 `no such service: traefik` 오류가 나타나지 않고 전체 의존 관계(`traefik` 등)를 올바르게 로드하는 환경이 마련되었습니다.

---

