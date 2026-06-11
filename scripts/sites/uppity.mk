# ==============================================================================
# 📰 Uppity Scraper Commands Module
# ==============================================================================

.PHONY: list refresh-urls refresh-silver help

PAGE       ?= 1
LIST_SLACK ?= 2
SECTION    ?=

help:
	@echo "========================================================================="
	@echo "📰 Uppity Scraper Module Commands Help"
	@echo "========================================================================="
	@echo "사용 가능한 명령어 목록:"
	@echo "  make up-list         - Uppity 게시글 목록 수집을 실행합니다."
	@echo "                        (예: make up-list PAGE=1-5 SECTION=news)"
	@echo "  make up-refresh-urls - Redis 큐를 복구 및 수정합니다."
	@echo "  make up-refresh-silver - 실버 레이어 누락 데이터를 재가공합니다."
	@echo "========================================================================="

list: PRIORITY := high
list:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [Uppity] Starting list scraping (PAGE: $(PAGE), SECTION: $(SECTION))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) -e LIST_SLACK=$(LIST_SLACK) -e SECTION=$(SECTION) worker npx ts-node src/crawler/sites/uppity/List.ts

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [Uppity] Refreshing target queue URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/crawler/core/cli-refresh-urls.ts uppity

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [Uppity] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/crawler/core/cli-refresh-silver.ts uppity


