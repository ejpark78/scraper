# ==============================================================================
# 🔥 PyTorch KR Scraper Commands Module
# ==============================================================================

.PHONY: list refresh-urls refresh-md fix-bronze-html

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

fix-bronze-html:
	$(COMPOSE) run --rm $(RUN_USER) clipper node --max-old-space-size=2048 --require ts-node/register src/sites/pytorch_kr/FixBronzeHtml.ts


