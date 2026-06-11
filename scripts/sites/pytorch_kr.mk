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
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) base npx ts-node src/crawler/sites/pytorch_kr/List.ts $(PAGE)

refresh:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [PyTorch KR] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) base npx ts-node src/crawler/core/cli-refresh-silver.ts pytorch_kr

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [PyTorch KR] Refreshing target queue URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) base npx ts-node src/crawler/core/cli-refresh-urls.ts pytorch_kr

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [PyTorch KR] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) base npx ts-node src/crawler/core/cli-refresh-silver.ts pytorch_kr


