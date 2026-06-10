# ==============================================================================
# 📘 AiCasebook Scraper Commands Module
# ==============================================================================

.PHONY: list refresh refresh-urls refresh-silver refresh-silver-rebuild

PAGE ?= 1-5

list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) clipper npx ts-node src/crawler/sites/aicasebook/List.ts

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-urls.ts aicasebook

refresh-silver:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts aicasebook


