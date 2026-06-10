# ==============================================================================
# 📰 GeekNews Scraper Commands Module
# ==============================================================================

include ../environments.mk

.PHONY: list refresh refresh-urls refresh-silver refresh-silver-rebuild

PAGE ?= 1-5

list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) clipper npx ts-node src/crawler/sites/geeknews/List.ts $(PAGE)

refresh:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/sites/geeknews/Backfill.ts $(DAY)

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-urls.ts geeknews

refresh-silver:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-transform.ts geeknews

refresh-silver-rebuild:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts geeknews
