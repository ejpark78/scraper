# ==============================================================================
# 📰 GeekNews Scraper Commands Module
# ==============================================================================

.PHONY: list contents backfill fix-queue

PAGE ?= 1

list:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/List.ts $(PAGE)

contents:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/Contents.ts $(PAGE)

backfill:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/Backfill.ts

fix-queue:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/FixQueue.ts


