# ==============================================================================
# 📰 GeekNews Scraper Commands Module
# ==============================================================================

.PHONY: list refresh refresh-urls refresh-silver

PAGE ?= 1-5

list: PRIORITY := high
list:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [GeekNews] Starting list scraping (PAGE: $(PAGE), DAY: $(DAY))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) $(WORKSPACE_MOUNT) -e PAGE=$(PAGE) worker npx ts-node --project /app/tsconfig.json src/cli-list.ts --site geeknews --page "$(PAGE)" --day "$(DAY)"

refresh: list

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [GeekNews] Refreshing target queue URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) $(WORKSPACE_MOUNT) worker npx ts-node --project /app/tsconfig.json src/cli-refresh-urls.ts --site geeknews

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [GeekNews] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) $(WORKSPACE_MOUNT) worker npx ts-node --project /app/tsconfig.json src/cli-refresh-silver.ts --site geeknews


