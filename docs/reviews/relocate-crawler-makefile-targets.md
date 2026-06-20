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

