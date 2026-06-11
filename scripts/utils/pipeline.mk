# ==============================================================================
# 🗄️ Pipeline
# ==============================================================================

.PHONY: *

SCALE ?= 3

restart:
	SCALE=$(SCALE) $(COMPOSE) up -d --build clipper-scraper clipper-transformer viewer

clear-queue:
	$(COMPOSE) run --rm $(RUN_USER) -v ./src/scripts:/app/src/scripts clipper npx ts-node src/scripts/clear-queue.ts

grep-errors:
	$(COMPOSE) logs --no-color clipper-scraper clipper-transformer | $(COMPOSE) run --rm -T $(RUN_USER) -v ./src/scripts:/app/src/scripts clipper npx ts-node src/scripts/grep-errors.ts

dump-queue:
	bash src/scripts/dump-queue.sh

fix-urls:
	bash src/scripts/run-fix-urls.sh

get-queue-status:
	$(COMPOSE) run --rm $(RUN_USER) -v ./src/scripts:/app/src/scripts clipper npx ts-node src/scripts/get-queue-status.ts
