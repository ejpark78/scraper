# ==============================================================================
# 🗄️ Pipeline
# ==============================================================================

.PHONY: *

SCALE         ?= 1
SCRIPTS_MOUNT ?= -v ./apps/crawler/src/scripts:/app/apps/crawler/src/scripts

restart:
	SCALE=$(SCALE) $(COMPOSE) up -d --build worker scraper converter

clear-queue:
	$(COMPOSE) run --rm $(RUN_USER) $(SCRIPTS_MOUNT) worker npx ts-node apps/crawler/src/scripts/queue.ts --clear

grep-errors:
	$(COMPOSE) logs --no-color scraper converter | $(COMPOSE) run --rm -T $(RUN_USER) $(SCRIPTS_MOUNT) worker npx ts-node apps/crawler/src/scripts/grep-errors.ts

dump-queue:
	@echo "📥 Dumping all active Redis scrape queues to [data/queue_dump.json]..."
	$(COMPOSE) run --rm $(RUN_USER) $(SCRIPTS_MOUNT) -v $$(pwd)/data:/app/data worker npx ts-node apps/crawler/src/scripts/queue.ts --dump
	@echo "🎉 Done! You can view the dump at: data/queue_dump.json"

fix-urls:
	@echo "=== 📊 [BEFORE] Redis Queue Status ==="
	$(COMPOSE) run --rm $(RUN_USER) $(SCRIPTS_MOUNT) worker npx ts-node apps/crawler/src/scripts/queue.ts --status
	@echo "🧼 Starting Target URL & Queue Cleanup..."
	$(COMPOSE) run --rm $(RUN_USER) $(SCRIPTS_MOUNT) worker npx ts-node apps/crawler/src/scripts/fix-urls.ts
	@echo "=== 📊 [AFTER] Redis Queue Status ==="
	$(COMPOSE) run --rm $(RUN_USER) $(SCRIPTS_MOUNT) worker npx ts-node apps/crawler/src/scripts/queue.ts --status
	@echo "🎉 Cleanup process complete!"

get-queue-status:
	$(COMPOSE) run --rm $(RUN_USER) $(SCRIPTS_MOUNT) worker npx ts-node apps/crawler/src/scripts/queue.ts --status
