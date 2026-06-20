# ADR 0004: Move Crawler Scripts to NPM Scripts

## Status
Approved

## Context
- 현재 각 사이트별 스크래핑/마이그레이션 실행 단축 명령어가 프로젝트 루트의 `scripts/sites/*.mk` 디렉토리에 개별 Makefile 모듈 형태로 분산되어 관리되고 있습니다.
- 이는 모노레포 아키텍처 상 관심사 분리(Separation of Concerns) 측면에서 크롤러 앱(`apps/crawler`)의 독립성을 저해하고 결합도를 높이는 한계가 있습니다.
- 대안으로 (1) `apps/crawler/Makefile`로의 통합, (2) 각 사이트 소스 폴더 바로 옆에 Makefile 결합, (3) `package.json`의 npm 스크립트로 전환하는 방안이 논의되었습니다.

## Decision
- Node.js 생태계 표준 및 일관성 있는 CLI 인자 처리를 위해 **대안 3(`package.json`의 npm 스크립트 전환)**을 채택하기로 결정하였습니다.
- 개별 사이트별 빌드/실행 명령어들을 `apps/crawler/package.json` 내 스크립트(`scrape:<site>:<command>`)로 전부 이관 및 재구성합니다.
- 단, 도커(Docker Compose) 구동 편의성과 기존 CLI 호환성 유지를 위해 루트 `Makefile`에서는 이 npm 스크립트를 docker compose를 통해 원스톱으로 기동해주는 래퍼 규칙을 유지합니다.

## Consequences
- **장점 (Benefits)**:
  * 크롤러 앱 내에 실행/빌드 스크립트가 온전히 포섭되어 결합도가 낮아지고 모듈 격리가 강화됩니다.
  * Node.js 표준 인자 포워딩(`--`) 및 환경변수 주입을 활용하여 파라미터 전달 규칙이 균일해집니다.
  * 흩어져 있던 다수의 `.mk` 파일들이 단일 `package.json`에 수렴되어 파일 수가 줄어들고 형상 관리가 단순해집니다.
- **단점/감수할 점 (Costs / Drawbacks)**:
  * 호스트 OS 권한 우회 및 Docker 볼륨 설정을 감안하기 위해 루트 Makefile 레벨에서 `docker compose run`을 래핑하는 얇은 포워딩 타겟 코딩이 필요합니다.
