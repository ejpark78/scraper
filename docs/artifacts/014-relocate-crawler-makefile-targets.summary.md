# Summary: 014-relocate-crawler-makefile-targets

> Squashed from: 014-relocate-crawler-makefile-targets.review.md 014-relocate-crawler-makefile-targets.task.md 014-relocate-crawler-makefile-targets.walkthrough.md

---

## Review

# Code Review: Crawler Makefile 타겟 이관 및 통합 포워딩 구성

본 코드 리뷰는 루트 Makefile의 크롤러 사이트별 타겟 및 테스트/추출/디버그 빌드 타겟을 `apps/crawler/Makefile`로 이관한 뒤, 루트 Makefile에 위임 게이트웨이 포워딩 구성을 설계한 변경 사항을 검토합니다.

## Review Summary
- **Target Files**: `Makefile` (Root), `apps/crawler/Makefile`
- **Goal**: 루트 Makefile에 정의되어 있던 복잡한 사이트별 설정들을 모노레포의 crawler 하위 프로젝트 내부로 캡슐화하고 응집도 향상.
- **Result**: 루트 `Makefile`은 위임 포워딩 룰로 단순화되었고, 모든 세부 실행 명세는 `apps/crawler/Makefile` 내부에서 처리됩니다.

## Checklist
- [x] **No Host Port Access**: 변경 사항은 Docker 포트 바인딩 및 호스트 포트 노출과 무관합니다.
- [x] **Compatibility**: 기존 루트에서 호출하던 명령어의 호환성이 깨지지 않도록 와일드카드 및 개별 사이트별 포워딩 규칙이 올바르게 설계되었는지 확인했습니다.
- [x] **Pattern Dry-Run**: `test-%` 및 사이트 패턴 매칭 타겟들이 하위 Makefile로의 재귀 호출 단계에서 변수 누락 없이 매핑되는지 점검했습니다.

## Detailed Review

### 1. Root Makefile
```diff
-# sites grouped targets
-list: RECURSIVE_SCRAPE=true
-list: gpt-list gn-list ...
-
-gpt-%:
-	@$(MAKE) -C apps/crawler run-scrape SITE=gpters CMD=$* ...
+# crawler app forwarding
+list refresh-urls refresh-silver rebuild restart clear-queue grep-errors dump-queue fix-urls get-queue-status extract debug:
+	@$(MAKE) -C apps/crawler $@
+
+test-%:
+	@$(MAKE) -C apps/crawler $@
+
+gm-%:
+	@$(MAKE) -C apps/crawler gmail-$*
+
+gpt-% gn-% ddds-% pk-% ab-% up-% mj-% yz-% li-%:
+	@$(MAKE) -C apps/crawler $@
```
- **의견**: GNU Make 문법 규칙에 따라 패턴 규칙(`test-%`)을 일반 타겟들과 분리하여 `혼합된 묵시적 규칙과 일반적 규칙` 빌드 에러를 안전하게 방지하였습니다.

### 2. apps/crawler/Makefile
```diff
+# sites
+gpt-%:
+	@$(MAKE) run-scrape SITE=gpters CMD=$*
...
+test-%:
+	$(COMPOSE) run --rm $(RUN_USER) -e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE) -e SITE=$(SITE) worker npm run test:$*
```
- **의견**: 크롤러 서브 모듈 내에 사이트 관련 빌드/실행 책임을 모두 모았으며, `test-%` 와일드카드 라우팅을 추가하여 향후 추가되는 테스트 스크립트도 별도 Makefile 수정 없이 손쉽게 실행할 수 있게 되었습니다.

### 3. apps/ebook Config
- **의견**: `apps/ebook/pyproject.toml`에 `poethepoet` 플러그인을 추가하고 `[tool.poe.tasks]` 설정을 선언하여 npm scripts와 정확하게 일치하는 단축 태스크 쉘 명령어(`summary`, `analyze` 등) 구조를 갖추었습니다. 이때 상대 임포트 경로가 비정상 처리되지 않도록 단독 파일 실행이 아닌 `python -m src.process` 모듈 실행 방식을 채택했습니다.
- **의견**: `apps/ebook/Makefile`에서도 호출 방식을 `uv run poe <task>`로 변경하여 태스크 러너 기반의 일관성 있는 호출 인터페이스를 완성하였습니다. 또한, 프로파일 제한이 걸려 빌드에서 제외되던 오류 및 빌더 캐시 파손 오류를 원천 예방하기 위해 `build` 타겟에 대상 서비스명과 무캐시 플래그(`build --no-cache ebook`)를 명시하여 안정성을 극대화했습니다. 추가로 `html` 타겟의 `PDF` 매개변수 체크 오류 분기를 개선하고, CLI 변수 인입용 `OUTPUT` 메이크 변수를 추가하여 안정적인 경로 설정 흐름을 구성했습니다.
- **의견**: `apps/ebook/src/process.py`의 `--html` 인자를 선택형(`nargs="?"`)으로 변환하고 전체 변환(`all`)에 대한 비즈니스 로직을 삽입하여, 파일이 지정되지 않았을 때의 UX 및 배치 기능을 향상시켰습니다.
- **의견**: `apps/ebook/src/pdf_to_html.py`에서 아웃풋 경로 구성을 입력 PDF 경로를 직접 치환(`with_suffix(".html")`)하도록 변경하여, 사용자가 기대했던 동일 디렉토리 내 결과물 생성 구조를 만족시켰습니다.


---

## Task

# Task: Crawler Makefile 타겟 이관 및 통합 포워딩 구성 작업

루트 Makefile에서 `apps/crawler/Makefile`로의 타겟 이관 관련 할 일 목록 및 진행 상태 기록입니다.

- [x] 변경 계획 제안 및 사용자 승인 획득
- [x] `docs/plans/relocate-crawler-makefile-targets.md` 계획서 작성
- [x] 루트 `Makefile` 내 사이트 매핑 및 테스트/디버깅 타겟 제거 및 포워딩 규칙 추가
- [x] `apps/crawler/Makefile` 내 사이트 매핑, 복합 타겟, `test-%` 와일드카드 규칙 추가
- [x] `docs/reviews/relocate-crawler-makefile-targets.md` 코드 리뷰 작성
- [x] `docs/reviews/relocate-crawler-makefile-targets.walkthrough.md` 결과 보고서 작성

---

## Walkthrough

# Walkthrough: Crawler Makefile 타겟 이관 및 통합 포워딩 구성 결과 보고서

## 작업 결과 요약
- 루트 `Makefile`에 존재하던 모든 개별 사이트별 타겟과 `list`, `refresh-*` 같은 복합 타겟, 그리고 테스트/추출/디버그 세부 타겟들을 `apps/crawler/Makefile`로 온전히 이관하였습니다.
- 추가적으로, GNU Make의 CLI 변수 자동 상속 동작을 활용하여 `extract`, `debug`, `test-%` 및 `rebuild`, `restart`, `clear-queue` 등 모든 크롤러 인프라/유틸리티성 타겟들을 대통합 포워딩 규칙으로 묶어 정리하였고, 패턴 규칙인 `test-%`를 일반 타겟 규칙과 분리하여 `혼합된 묵시적 규칙과 일반적 규칙` 문법 오류를 완벽히 해결하였습니다.
- 파이썬 이북 프로젝트(`apps/ebook/pyproject.toml`)에 `poethepoet` 라이브러리를 의존성에 추가하고 `[tool.poe.tasks]` 스크립트들을 등록하여 npm scripts와 완벽하게 대칭되는 방식으로 단축 명령어들을 구성하였습니다. 이때 상대 임포트 경로가 비정상 처리되지 않도록 단독 파일 실행이 아닌 `python -m src.process` 모듈 실행 방식을 채택했습니다.
- 이와 연계하여 `apps/ebook/Makefile` 내의 실행 구문들도 `uv run poe <task>` 형태로 리팩토링하여 로컬 가상환경 및 도커 컴포즈 상에서 실행 일관성을 확보했습니다. 또한, 프로파일 제한 및 캐시 손상 문제를 예방하고자 `make build` 동작 시 `--no-cache` 옵션을 동반해 `ebook` 서비스를 직접 빌드하도록 조치했습니다.
- `apps/ebook/Makefile`의 `html` 타겟 및 `apps/ebook/src/process.py` 스크립트를 개선하여 `PDF` 변수가 전달되지 않았을 때 `output` 하위 디렉토리 내의 모든 `.pdf` 문서를 일괄 HTML 변환하는 플로우를 구성했습니다. 또한 CLI 옵션 지정 충돌 오류를 막고자 메이크 변수 `OUTPUT`을 활용하여 경로를 입력받게끔 개선하였습니다.
- 변환 대상 HTML 저장 경로를 입력 PDF가 위치한 경로와 완벽하게 일치(`pdf_path.with_suffix(".html")`)하도록 개선하여, 하위 폴더(`Beyond Vibe Coding` 등) 구조가 결과물 디렉토리 내에서도 온전히 보존되도록 구현하였습니다.
- 루트 `Makefile`에는 대통합 포워딩 룰만 남겨두어, 사용자가 루트 디렉토리에서 기존 명령어(`make gpt-list`, `make test-recursive SITE=yozm`, `make clear-queue`, `make debug SITE=yozm ID=3800`)를 입력하더라도 문제 없이 `apps/crawler/Makefile`로 완벽하게 포워딩되어 동일하게 실행됩니다.

## 변경 파일
- `[MODIFY]` [Makefile](file:///home/ejpark/workspace/scraper/Makefile)
- `[MODIFY]` [apps/crawler/Makefile](file:///home/ejpark/workspace/scraper/apps/crawler/Makefile)
- `[MODIFY]` [apps/ebook/pyproject.toml](file:///home/ejpark/workspace/scraper/apps/ebook/pyproject.toml)
- `[MODIFY]` [apps/ebook/Makefile](file:///home/ejpark/workspace/scraper/apps/ebook/Makefile)
- `[MODIFY]` [apps/ebook/src/process.py](file:///home/ejpark/workspace/scraper/apps/ebook/src/process.py)
- `[MODIFY]` [apps/ebook/src/pdf_to_html.py](file:///home/ejpark/workspace/scraper/apps/ebook/src/pdf_to_html.py)
- `[NEW]` [apps/ebook/src/__init__.py](file:///home/ejpark/workspace/scraper/apps/ebook/src/__init__.py)

## 검증 결과
- 루트 디렉토리에서 문법 에러 메시지가 더 이상 나타나지 않으며, `make build`, `make down up` 등 명령어가 에러 없이 매끄럽게 통과됩니다.
- `apps/ebook` 디렉토리 내에서 `uv run poe summary` 명령어와 같이 npm scripts처럼 CLI를 통해 래핑 동작이 잘 수행되는 구조가 마련되었습니다.
- `make ebook-summary` (또는 `apps/ebook` 내 `make summary`) 호출 시 도커 컨테이너 내부에서도 `uv run poe summary` 규칙을 타서 에러 없이 정상적으로 서머리를 출력합니다.
- `make ebook-build` 호출 시 프로파일 제한 및 캐시 손상 우려와 무관하게 `ebook` 이미지 무캐시 빌드가 정상 작동합니다.
- `make ebook-html OUTPUT=data/output` 호출 시 메이크 옵션 파싱 에러 없이 `data/output` 디렉토리 하위의 모든 pdf 문서에 대한 일괄 HTML 변환 배치 루프가 작동하며, 변환 결과가 각 PDF와 동일한 폴더 내부에 정확하게 안착합니다.

---

