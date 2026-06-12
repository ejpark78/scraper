# ==============================================================================
# 💡 GPTERS Scraper Commands Module
# ==============================================================================

.PHONY: list refresh refresh-urls refresh-silver newsletter-list newsletter-refresh

LIMIT ?= 20
PAGE ?= 5

list: PRIORITY := high
list:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [GPTERS News] Starting news list scraping (PAGE: $(PAGE), LIMIT: $(LIMIT))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) worker npx ts-node src/crawler/core/cli-list.ts --site gpters_news --page "$(PAGE)" --limit "$(LIMIT)"

refresh:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [GPTERS News] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/crawler/core/cli-refresh-silver.ts gpters

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [GPTERS] Refreshing target queue URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/crawler/core/cli-refresh-urls.ts gpters

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [GPTERS News] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/crawler/core/cli-refresh-silver.ts gpters


newsletter-list: PRIORITY := high
newsletter-list:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [GPTERS Newsletter] Starting newsletter list scraping (PAGE: $(PAGE), LIMIT: $(LIMIT))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) worker npx ts-node src/crawler/core/cli-list.ts --site gpters_newsletter --page "$(PAGE)" --limit "$(LIMIT)"

newsletter-refresh:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [GPTERS Newsletter] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/crawler/core/cli-refresh-silver.ts gpters_newsletter

refresh-silver-rebuild:
	@echo "──────────────────────────────────────────────────"
	@echo "🔨 [GPTERS News] Rebuilding Silver Layer items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/crawler/core/cli-refresh-silver.ts gpters

newsletter-refresh-silver-rebuild:
	@echo "──────────────────────────────────────────────────"
	@echo "🔨 [GPTERS Newsletter] Rebuilding Silver Layer items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/crawler/core/cli-refresh-silver.ts gpters_newsletter
