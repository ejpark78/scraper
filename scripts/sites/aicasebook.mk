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
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) clipper npx ts-node src/crawler/sites/aicasebook/List.ts

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [AiCasebook] Refreshing target queue URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-urls.ts aicasebook

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [AiCasebook] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts aicasebook


