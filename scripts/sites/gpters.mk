# ==============================================================================
# 💡 GPTERS Scraper Commands Module
# ==============================================================================

.PHONY: list refresh refresh-urls refresh-silver newsletter-list newsletter-refresh

LIMIT ?= 20
OVERWRITE ?= false
PAGE ?= 5
PRIORITY ?= medium
SLACK_TIME ?= 3

list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) -e PRIORITY=$(PRIORITY) -e OVERWRITE=$(OVERWRITE) -e PAGE=$(PAGE) -e SLACK_TIME=$(SLACK_TIME) clipper npx ts-node src/crawler/sites/gpters/news/List.ts $(LIMIT)

refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/crawler/sites/gpters/news/Refresh.ts

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) -e OVERWRITE=$(OVERWRITE) clipper npx ts-node src/crawler/sites/gpters/news/RefreshUrls.ts

refresh-silver:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/crawler/sites/gpters/news/QueueTransform.ts

newsletter-list: PRIORITY := high
newsletter-list:
	$(COMPOSE) run --rm $(RUN_USER) -e PRIORITY=$(PRIORITY) -e OVERWRITE=$(OVERWRITE) -e PAGE=$(PAGE) -e SLACK_TIME=$(SLACK_TIME) clipper npx ts-node src/crawler/sites/gpters/newsletter/List.ts $(LIMIT)

newsletter-refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/crawler/sites/gpters/newsletter/Refresh.ts
