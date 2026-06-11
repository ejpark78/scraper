# ==============================================================================
# 🗄️ Pipeline
# ==============================================================================

.PHONY: *

SCALE ?= 3

restart:
	SCALE=$(SCALE) $(COMPOSE) up -d --build clipper-scraper clipper-transformer viewer

clear-queue:
	$(COMPOSE) run --rm $(RUN_USER) -v ./src/scripts:/app/src/scripts clipper npx ts-node src/scripts/clear-queue.ts
