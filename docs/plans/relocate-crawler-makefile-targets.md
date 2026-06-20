# Plan: Crawler Makefile 타겟 이관 및 통합 포워딩 구성

루트 Makefile에 복잡하게 얽혀 있던 크롤러 사이트별 구체적 타겟 및 테스트/추출/디버그 실행 타겟들을 크롤러 서브 패키지(`apps/crawler/Makefile`)로 이관하고, 루트 Makefile은 단순히 위임(포워딩)하는 게이트웨이 역할만 하도록 아키텍처를 정돈합니다.

## User Review Required
> [!IMPORTANT]
> - 기존 루트에서 돌리던 `make gpt-list`, `make test-recursive SITE=yozm` 등의 명령어 사용법은 그대로 유지됩니다. 루트 Makefile이 변경사항을 자동으로 `apps/crawler/Makefile`로 넘겨주기 때문입니다.
> - 새로운 크롤러 사이트가 추가될 때 이제 루트 Makefile을 수정할 필요 없이 `apps/crawler/Makefile` 내부만 수정해주면 되므로 작업 반경이 줄어듭니다.

## Proposed Changes

### 1. Root Makefile
- **`[MODIFY]`** `Makefile`:
  - `list`, `refresh-urls`, `refresh-silver` 제거
  - `gpt-%`, `gn-%`, `ddds-%`, `pk-%`, `ab-%`, `up-%`, `mj-%`, `yz-%`, `li-%` 사이트별 직접 맵 타겟 제거
  - `test-%`, `extract`, `debug` 등 상세 호출 룰 제거
  - `rebuild`, `restart`, `clear-queue`, `grep-errors`, `dump-queue`, `fix-urls`, `get-queue-status` 개별 타겟 제거 및 병합 포워딩 설정
  - `gm-%` 및 모든 크롤러 타겟에 대해 변수 자동 상속을 활용한 대통합 포워딩 룰 구성(문법 에러 방지를 위해 패턴 규칙인 `test-%`는 일반 규칙과 분리):
    ```makefile
    list refresh-urls refresh-silver rebuild restart clear-queue grep-errors dump-queue fix-urls get-queue-status extract debug:
    	@$(MAKE) -C apps/crawler $@

    test-%:
    	@$(MAKE) -C apps/crawler $@

    gm-%:
    	@$(MAKE) -C apps/crawler gmail-$*

    gpt-% gn-% ddds-% pk-% ab-% up-% mj-% yz-% li-%:
    	@$(MAKE) -C apps/crawler $@
    ```

### 2. Crawler Makefile
- **`[MODIFY]`** `apps/crawler/Makefile`:
  - 루트 Makefile에서 잘라낸 `list`, `refresh-urls`, `refresh-silver` 정의부 추가
  - 개별 사이트별 빌드/실행 타겟 정의부 추가 (`gpt-%`, `gn-%`, `ddds-%` 등)
  - `test-%` 동적 라우팅 타겟 추가
    ```makefile
    test-%:
    	$(COMPOSE) run --rm $(RUN_USER) -e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE) -e SITE=$(SITE) worker npm run test:$*
    ```

### 3. Ebook App Configuration
- **`[MODIFY]`** `apps/ebook/pyproject.toml`:
  - `poethepoet` 라이브러리를 의존성에 추가하고, `[tool.poe.tasks]` 섹션을 통해 `summary`, `analyze`, `split`, `md`, `html`, `translate` 단축 쉘 명령 정의 (상대 임포트 작동 보장을 위해 파일 호출이 아닌 `python -m src.process` 모듈 호출 방식을 사용하도록 구성)
- **`[NEW]`** `apps/ebook/src/__init__.py`:
  - 모듈 상대 경로 임포트 보장을 위한 빈 패키지 마커 파일 생성
- **`[MODIFY]`** `apps/ebook/Makefile`:
  - 실행 명령어 호출부를 `uv run ebook-process`에서 `uv run poe <task>` 형태로 리팩토링하여 일치 보장
  - `build` 타겟의 도커 컴포즈 빌드 명령어에 프로파일 제약을 극복하고 캐시 꼬임 문제를 원천 차단하기 위해 `--no-cache ebook`으로 빌드 방식 수정
  - `html` 타겟에 `PDF` 생략 시 에러를 뿜는 대신 인자 없이 호출하도록 수정하여 전체 일괄 변환 기능 연동
  - `OUTPUT ?= output` 변수를 선언하고, `html` 타겟 호출 시 `--output "$(OUTPUT)"`을 덧붙이도록 개선하여 CLI 옵션 전달 오버헤드 해소
- **`[MODIFY]`** `apps/ebook/src/process.py`:
  - `--html` 인자를 선택적으로 허용하도록 변경하고, 비어있거나 "all"인 경우 `output` 내의 모든 PDF를 찾아 일괄 변환하는 기능 구현

---

## Verification Plan

### Manual Verification
- 루트 디렉토리에서 기존 핵심 명령 실행이 정상 동작하는지 테스트합니다:
  - `make yz-list` 실행 후 동작 여부 확인
  - `make test-recursive SITE=yozm` 실행 후 정상 동작 여부 확인
  - `make debug SITE=yozm ID=3800` 실행 후 정상 동작 여부 확인
