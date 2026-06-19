# ==============================================================================
# 📘 AiCasebook Scraper Commands Module
# ==============================================================================

.PHONY: list refresh refresh-urls refresh-silver refresh-silver-rebuild

PAGE ?= 1-5

list: PRIORITY := high
list:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [AiCasebook] Starting list scraping (PAGE: $(PAGE))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) worker npx ts-node apps/crawler/src/cli-list.ts --site aicasebook --page "$(PAGE)"

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [AiCasebook] Refreshing target queue URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node apps/crawler/src/cli-refresh-urls.ts --site aicasebook

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [AiCasebook] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node apps/crawler/src/cli-refresh-silver.ts --site aicasebook


