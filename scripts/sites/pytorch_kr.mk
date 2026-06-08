# ==============================================================================
# 🔥 PyTorch KR Scraper Commands Module
# ==============================================================================

.PHONY: list refresh-urls refresh-md

PAGE ?= 1-10
SLACK_TIME ?= 3
SCRAPER_SLACK ?= 0
PRIORITY ?= medium
OVERWRITE ?= false

list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) -e SLACK_TIME=$(SLACK_TIME) -e SCRAPER_SLACK=$(SCRAPER_SLACK) -e PRIORITY=$(PRIORITY) -e OVERWRITE=$(OVERWRITE) clipper npx ts-node src/sites/pytorch_kr/List.ts $(PAGE)

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/pytorch_kr/RefreshUrls.ts

refresh-md:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/pytorch_kr/QueueTransform.ts


