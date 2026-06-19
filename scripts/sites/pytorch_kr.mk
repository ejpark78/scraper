# ==============================================================================
# 🔥 PyTorch KR Scraper Commands Module
# ==============================================================================

.PHONY: list refresh refresh-urls refresh-silver

PAGE ?= 1-10

list: PRIORITY := high
list:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [PyTorch KR] Starting list scraping (PAGE: $(PAGE))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) worker npx ts-node apps/crawler/src/cli-list.ts --site pytorch_kr --page "$(PAGE)"

refresh:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [PyTorch KR] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) worker npx ts-node apps/crawler/src/cli-refresh-silver.ts --site pytorch_kr

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [PyTorch KR] Refreshing target queue URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node apps/crawler/src/cli-refresh-urls.ts --site pytorch_kr

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [PyTorch KR] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node apps/crawler/src/cli-refresh-silver.ts --site pytorch_kr


