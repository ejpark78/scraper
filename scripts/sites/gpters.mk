# ==============================================================================
# 💡 GPTERS Scraper Commands Module
# ==============================================================================

.PHONY: list refresh refresh-urls refresh-silver refresh-silver-rebuild newsletter-list newsletter-refresh

LIMIT ?= 20
OVERWRITE ?= false
PAGE ?= 5
PRIORITY ?= medium
SLACK_TIME ?= 3
RECURSIVE_SCRAPE ?= false

list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) -e PRIORITY=$(PRIORITY) -e OVERWRITE=$(OVERWRITE) -e PAGE=$(PAGE) -e SLACK_TIME=$(SLACK_TIME) -e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE) clipper npx ts-node src/crawler/sites/gpters/news/List.ts $(LIMIT)

refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts gpters

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) -e OVERWRITE=$(OVERWRITE) clipper npx ts-node src/crawler/core/cli-refresh-urls.ts gpters

refresh-silver:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/crawler/core/cli-refresh-transform.ts gpters

newsletter-list: PRIORITY := high
newsletter-list:
	$(COMPOSE) run --rm $(RUN_USER) -e PRIORITY=$(PRIORITY) -e OVERWRITE=$(OVERWRITE) -e PAGE=$(PAGE) -e SLACK_TIME=$(SLACK_TIME) -e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE) clipper npx ts-node src/crawler/sites/gpters/newsletter/List.ts $(LIMIT)

newsletter-refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts gpters_newsletter

refresh-silver-rebuild:
	npx ts-node src/crawler/core/cli-refresh-silver.ts gpters

newsletter-refresh-silver-rebuild:
	npx ts-node src/crawler/core/cli-refresh-silver.ts gpters_newsletter
