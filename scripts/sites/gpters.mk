# ==============================================================================
# 💡 GPTERS Scraper Commands Module
# ==============================================================================

include ../environments.mk

.PHONY: list refresh refresh-urls refresh-silver refresh-silver-rebuild newsletter-list newsletter-refresh

LIMIT ?= 20
PAGE ?= 5

list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) clipper npx ts-node src/crawler/sites/gpters/news/List.ts $(LIMIT)

refresh:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts gpters

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-urls.ts gpters

refresh-silver:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-transform.ts gpters

newsletter-list: PRIORITY := high
newsletter-list:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) clipper npx ts-node src/crawler/sites/gpters/newsletter/List.ts $(LIMIT)

newsletter-refresh:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts gpters_newsletter

refresh-silver-rebuild:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts gpters

newsletter-refresh-silver-rebuild:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts gpters_newsletter
