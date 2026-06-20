# Walkthrough: Crawler Makefile 타겟 이관 및 통합 포워딩 구성 결과 보고서

## 작업 결과 요약
- 루트 `Makefile`에 존재하던 모든 개별 사이트별 타겟과 `list`, `refresh-*` 같은 복합 타겟, 그리고 테스트/추출/디버그 세부 타겟들을 `apps/crawler/Makefile`로 온전히 이관하였습니다.
- 추가적으로, GNU Make의 CLI 변수 자동 상속 동작을 활용하여 `extract`, `debug`, `test-%` 및 `rebuild`, `restart`, `clear-queue` 등 모든 크롤러 인프라/유틸리티성 타겟들을 대통합 포워딩 규칙으로 묶어 정리하였고, 패턴 규칙인 `test-%`를 일반 타겟 규칙과 분리하여 `혼합된 묵시적 규칙과 일반적 규칙` 문법 오류를 완벽히 해결하였습니다.
- 파이썬 이북 프로젝트(`apps/ebook/pyproject.toml`)에 `poethepoet` 라이브러리를 의존성에 추가하고 `[tool.poe.tasks]` 스크립트들을 등록하여 npm scripts와 완벽하게 대칭되는 방식으로 단축 명령어들을 구성하였습니다.
- 이와 연계하여 `apps/ebook/Makefile` 내의 실행 구문들도 `uv run poe <task>` 형태로 리팩토링하여 로컬 가상환경 및 도커 컴포즈 상에서 실행 일관성을 확보했습니다.
- 루트 `Makefile`에는 대통합 포워딩 룰만 남겨두어, 사용자가 루트 디렉토리에서 기존 명령어(`make gpt-list`, `make test-recursive SITE=yozm`, `make clear-queue`, `make debug SITE=yozm ID=3800`)를 입력하더라도 문제 없이 `apps/crawler/Makefile`로 완벽하게 포워딩되어 동일하게 실행됩니다.

## 변경 파일
- `[MODIFY]` [Makefile](file:///home/ejpark/workspace/scraper/Makefile)
- `[MODIFY]` [apps/crawler/Makefile](file:///home/ejpark/workspace/scraper/apps/crawler/Makefile)
- `[MODIFY]` [apps/ebook/pyproject.toml](file:///home/ejpark/workspace/scraper/apps/ebook/pyproject.toml)
- `[MODIFY]` [apps/ebook/Makefile](file:///home/ejpark/workspace/scraper/apps/ebook/Makefile)
- `[NEW]` [apps/ebook/src/__init__.py](file:///home/ejpark/workspace/scraper/apps/ebook/src/__init__.py)

## 검증 결과
- 루트 디렉토리에서 문법 에러 메시지가 더 이상 나타나지 않으며, `make build`, `make down up` 등 명령어가 에러 없이 매끄럽게 통과됩니다.
- `apps/ebook` 디렉토리 내에서 `uv run poe summary` 명령어와 같이 npm scripts처럼 CLI를 통해 래핑 동작이 잘 수행되는 구조가 마련되었습니다.
- `make ebook-summary` (또는 `apps/ebook` 내 `make summary`) 호출 시 도커 컨테이너 내부에서도 `uv run poe summary` 규칙을 타서 에러 없이 정상적으로 서머리를 출력합니다.
