# ==============================================================================
# 💡 GPTERS Scraper Commands Module
# ==============================================================================

.PHONY: dispatch pipeline

LIMIT ?= 20

dispatch:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/gpters/GptersDispatcher.ts $(LIMIT)

pipeline:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/gpters/GptersPipeline.ts $(LIMIT)
