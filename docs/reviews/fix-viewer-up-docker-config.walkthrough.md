# Walkthrough: Viewer Up Docker Config 수정 결과 보고서

## 작업 결과 요약
- `apps/viewer/Makefile`의 `COMPOSE` 구문에서 중복 지정되어 `include` 블록의 올바른 병합을 방해하던 `-f compose.yml` 플래그를 제거하였습니다.
- 이로 인해 루트의 `compose.yml`이 정상 파싱되고, `include`된 `traefik`, `mongodb`, `redis` 등 인프라 서비스와 `viewer` 서비스들이 온전하게 인식됩니다.

## 변경 파일
- `[MODIFY]` [apps/viewer/Makefile](file:///home/ejpark/workspace/scraper/apps/viewer/Makefile)

## 검증 결과
- 수정 후 `make viewer-up` 실행 시 `no such service: traefik` 오류가 나타나지 않고 전체 의존 관계(`traefik` 등)를 올바르게 로드하는 환경이 마련되었습니다.
