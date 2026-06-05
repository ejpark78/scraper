# ==============================================================================
# 📰 GeekNews Scraper Commands Module
# ==============================================================================

.PHONY: dispatch pipeline

PAGE ?= 1

dispatch:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/geeknews/GeekNewsDispatcher.ts $(PAGE)

pipeline:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/geeknews/GeekNewsPipeline.ts $(PAGE)
