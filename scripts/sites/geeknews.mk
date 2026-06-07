# ==============================================================================
# 📰 GeekNews Scraper Commands Module
# ==============================================================================

.PHONY: list contents refresh fix-queue

PAGE ?= 1

list:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/List.ts $(PAGE)

contents:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/Contents.ts $(PAGE)

refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/Refresh.ts

fix-queue:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/geeknews/FixQueue.ts


