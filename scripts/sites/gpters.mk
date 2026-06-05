# ==============================================================================
# 💡 GPTERS Scraper Commands Module
# ==============================================================================

.PHONY: list contents backfill fix-queue

LIMIT ?= 20

list:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/gpters/List.ts $(LIMIT)

contents:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/gpters/Contents.ts $(LIMIT)

backfill:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/gpters/Backfill.ts

fix-queue:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/gpters/FixQueue.ts


