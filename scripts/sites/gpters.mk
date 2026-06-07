# ==============================================================================
# 💡 GPTERS Scraper Commands Module
# ==============================================================================

.PHONY: list contents refresh refresh-urls

LIMIT ?= 20

list:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/gpters/List.ts $(LIMIT)

contents:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/gpters/Contents.ts $(LIMIT)

refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/gpters/Refresh.ts

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/gpters/RefreshUrls.ts


