# ==============================================================================
# 📰 GeekNews Scraper Commands Module
# ==============================================================================

.PHONY: list contents refresh refresh-urls

PAGE ?= 1
SLACK_TIME ?= 3

list:
	$(COMPOSE) run --rm $(RUN_USER) -e SLACK_TIME=$(SLACK_TIME) clipper npx ts-node src/sites/geeknews/List.ts $(PAGE)

contents:
	$(COMPOSE) run --rm $(RUN_USER) -e SLACK_TIME=$(SLACK_TIME) clipper npx ts-node src/sites/geeknews/Contents.ts $(PAGE)

refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/Refresh.ts

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/RefreshUrls.ts


