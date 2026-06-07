# ==============================================================================
# 📰 GeekNews Scraper Commands Module
# ==============================================================================

.PHONY: list contents refresh refresh-urls

PAGE ?= 1
SLACK_TIME ?= 3
SCRAPER_SLACK ?= 0
PRIORITY ?= medium

list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) -e SLACK_TIME=$(SLACK_TIME) -e SCRAPER_SLACK=$(SCRAPER_SLACK) -e PRIORITY=$(PRIORITY) clipper npx ts-node src/sites/geeknews/List.ts 1-5

refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/Refresh.ts

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/RefreshUrls.ts

backfill:
	$(COMPOSE) run --rm $(RUN_USER) -e SLACK_TIME=$(SLACK_TIME) -e SCRAPER_SLACK=$(SCRAPER_SLACK) -e PRIORITY=$(PRIORITY) clipper npx ts-node src/sites/geeknews/Backfill.ts $(DAY)


