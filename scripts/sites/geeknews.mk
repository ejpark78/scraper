# ==============================================================================
# 📰 GeekNews Scraper Commands Module
# ==============================================================================

.PHONY: list refresh refresh-urls refresh-silver

PAGE ?= 1-5
SLACK_TIME ?= 3
SCRAPER_SLACK ?= 0
PRIORITY ?= medium
OVERWRITE ?= false

list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) -e SLACK_TIME=$(SLACK_TIME) -e SCRAPER_SLACK=$(SCRAPER_SLACK) -e PRIORITY=$(PRIORITY) -e OVERWRITE=$(OVERWRITE) clipper npx ts-node src/crawler/sites/geeknews/List.ts 1-5

refresh:
	$(COMPOSE) run --rm $(RUN_USER) -e SLACK_TIME=$(SLACK_TIME) -e SCRAPER_SLACK=$(SCRAPER_SLACK) -e PRIORITY=$(PRIORITY) clipper npx ts-node src/crawler/sites/geeknews/Backfill.ts $(DAY)

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) -e OVERWRITE=$(OVERWRITE) clipper npx ts-node src/crawler/sites/geeknews/RefreshUrls.ts

refresh-silver:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/crawler/sites/geeknews/QueueTransform.ts
