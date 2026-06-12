# ==============================================================================
# 📰 GeekNews Scraper Commands Module
# ==============================================================================

.PHONY: list refresh refresh-urls refresh-silver

PAGE ?= 1-5

list: PRIORITY := high
list:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [GeekNews] Starting list scraping (PAGE: $(PAGE))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) worker npx ts-node src/crawler/sites/geeknews/List.ts $(PAGE)

refresh:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [GeekNews] Starting backfill refresh (DAY: $(DAY))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/crawler/sites/geeknews/List.ts $(DAY)

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [GeekNews] Refreshing target queue URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/crawler/core/cli-refresh-urls.ts geeknews

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [GeekNews] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/crawler/core/cli-refresh-silver.ts geeknews


