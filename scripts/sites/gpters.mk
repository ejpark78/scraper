# ==============================================================================
# 💡 GPTERS Scraper Commands Module
# ==============================================================================

.PHONY: list contents refresh refresh-urls

LIMIT ?= 20
PRIORITY ?= medium

list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) -e PRIORITY=$(PRIORITY) clipper npx ts-node src/sites/gpters/List.ts $(LIMIT)

refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/gpters/Refresh.ts

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/gpters/RefreshUrls.ts


