# ==============================================================================
# 📚 Daily Dose of Data Science Scraper Commands Module
# ==============================================================================

.PHONY: list refresh-urls refresh-silver refresh-silver-rebuild help

# 📝 환경변수 기본값 설정
PAGE       ?= 1
SLACK_TIME ?= 3
PRIORITY   ?= medium
OVERWRITE  ?= false
RECURSIVE_SCRAPE ?= false

help:
	@echo "========================================================================="
	@echo "📚 Daily Dose of DS Scraper Module Commands Help"
	@echo "========================================================================="
	@echo "사용 가능한 명령어 목록:"
	@echo "  make ddds-list        - Daily Dose of DS 게시글 목록 수집을 실행합니다."
	@echo "                        (예: make ddds-list PAGE=5 SLACK_TIME=3 RECURSIVE_SCRAPE=true)"
	@echo "  make ddds-refresh-urls - 타겟 설정에 맞춰 Redis 큐를 복구 및 수정합니다."
	@echo "  make ddds-refresh-silver - 실버 레이어 누락 데이터를 Redis 큐에 넣어 재가공합니다."
	@echo "========================================================================="

list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) -e PAGE=$(PAGE) -e SLACK_TIME=$(SLACK_TIME) -e PRIORITY=$(PRIORITY) -e OVERWRITE=$(OVERWRITE) -e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE) clipper npx ts-node src/crawler/sites/dailydoseofds/List.ts

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) -e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE) clipper npx ts-node src/crawler/core/cli-refresh-urls.ts dailydose_ds

refresh-silver:
	$(COMPOSE) run --rm $(RUN_USER) -e OVERWRITE=$(OVERWRITE) clipper npx ts-node src/crawler/core/cli-refresh-transform.ts dailydose_ds

refresh-silver-rebuild:
	npx ts-node src/crawler/core/cli-refresh-silver.ts dailydose_ds
