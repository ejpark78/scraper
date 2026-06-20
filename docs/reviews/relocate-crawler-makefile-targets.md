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
+# sites & crawler forwarding
+list refresh-urls refresh-silver:
+	@$(MAKE) -C apps/crawler $@
+
+gpt-% gn-% ddds-% pk-% ab-% up-% mj-% yz-% li-%:
+	@$(MAKE) -C apps/crawler $@
+
+# crawler infra, queue & tools forwarding
+rebuild restart clear-queue grep-errors dump-queue fix-urls get-queue-status:
+	@$(MAKE) -C apps/crawler $@ SCALE=$(SCALE)
+
+gm-%:
+	@$(MAKE) -C apps/crawler gmail-$*
```
- **의견**: 기존의 지저분한 사이트 매핑 로직들과 더불어 `rebuild`, `restart`, `clear-queue` 등 다양한 인프라 제어/큐 관리 타겟들이 하나의 병합 포워딩 규칙으로 리팩토링되어, 루트 메이크파일의 유지 보수 비용을 획기적으로 줄이고 가독성을 크게 개선했습니다.

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
