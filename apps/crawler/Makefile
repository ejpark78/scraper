# Makefile for apps/crawler (Runs Docker commands)

# Define project root relative to this Makefile
export HOST_PROJECT_PATH = $(shell cd ../.. && pwd)

# Fallbacks for variables if not called from root Makefile
COMPOSE  ?= docker compose -p scraper -f ../../compose.yml
RUN_USER ?= --user $$(id -u):$$(id -g)

.PHONY: rebuild restart clear-queue grep-errors dump-queue fix-urls get-queue-status

# infra management
SCALE         ?= 1
rebuild:
	$(COMPOSE) build --no-cache worker scraper converter indexer

restart:
	SCALE=$(SCALE) $(COMPOSE) up -d worker scraper converter indexer

# queue & utils (forward to npm scripts)
clear-queue:
	$(COMPOSE) run --rm $(RUN_USER) worker npm run queue:clear

grep-errors:
	$(COMPOSE) logs --no-color scraper converter | $(COMPOSE) run --rm -T $(RUN_USER) worker npm run log:grep-errors

dump-queue:
	@echo "📥 Dumping all active Redis scrape queues to [data/queue_dump.json]..."
	$(COMPOSE) run --rm $(RUN_USER) -v $$(HOST_PROJECT_PATH)/data:/app/data worker npm run queue:dump
	@echo "🎉 Done! You can view the dump at: data/queue_dump.json"

fix-urls:
	@echo "=== 📊 [BEFORE] Redis Queue Status ==="
	$(COMPOSE) run --rm $(RUN_USER) worker npm run queue:status
	@echo "🧼 Starting Target URL & Queue Cleanup..."
	$(COMPOSE) run --rm $(RUN_USER) worker npm run queue:fix-urls
	@echo "=== 📊 [AFTER] Redis Queue Status ==="
	$(COMPOSE) run --rm $(RUN_USER) worker npm run queue:status
	@echo "🎉 Cleanup process complete!"

get-queue-status:
	$(COMPOSE) run --rm $(RUN_USER) worker npm run queue:status
