# Makefile for apps/crawler (Runs Docker commands)

# Dynamic detection of project root path via Make functions
ROOT_DIR := $(realpath $(dir $(lastword $(MAKEFILE_LIST)))../..)
export HOST_PROJECT_PATH = $(ROOT_DIR)

# Fallbacks for variables if not called from root Makefile
COMPOSE  ?= docker compose -p scraper -f $(ROOT_DIR)/compose.yml
RUN_USER ?= --user $$(id -u):$$(id -g)
LIST_SLACK       ?= 3
SCRAPER_SLACK    ?= 0
PRIORITY         ?= medium
OVERWRITE        ?= false
AUTH             ?= false
CHUNK_SIZE       ?= 500
ERROR_RESET      ?= false
RESET            ?= false
ENV_COMMON       ?= -e LIST_SLACK=$(LIST_SLACK) -e SCRAPER_SLACK=$(SCRAPER_SLACK) -e PRIORITY=$(PRIORITY) -e OVERWRITE=$(OVERWRITE) -e AUTH=$(AUTH) -e CHUNK_SIZE=$(CHUNK_SIZE) -e ERROR_RESET=$(ERROR_RESET) -e RESET=$(RESET) -e TS_NODE_PROJECT=tsconfig.json

.PHONY: rebuild restart clear-queue grep-errors dump-queue fix-urls get-queue-status run-scrape test-urls test-mcp test-recursive test-sites extract debug

# infra management
SCALE         ?= 1
rebuild:
	$(COMPOSE) build --no-cache worker scraper converter indexer

restart:
	SCALE=$(SCALE) $(COMPOSE) up -d worker scraper converter indexer

# sites grouped targets
list: gpt-list gn-list ddds-list pk-list ab-list up-list mj-list yz-list 

refresh-urls: gpt-refresh-urls gn-refresh-urls ddds-refresh-urls pk-refresh-urls ab-refresh-urls up-refresh-urls mj-refresh-urls yz-refresh-urls 

refresh-silver: gpt-refresh-silver gn-refresh-silver ddds-refresh-silver pk-refresh-silver ab-refresh-silver up-refresh-silver mj-refresh-silver yz-refresh-silver

# sites
gpt-%:
	@$(MAKE) run-scrape SITE=gpters CMD=$*

gn-%:
	@$(MAKE) run-scrape SITE=geeknews CMD=$*

ddds-%:
	@$(MAKE) run-scrape SITE=dailydoseofds CMD=$*

pk-%:
	@$(MAKE) run-scrape SITE=pytorch_kr CMD=$*

ab-%:
	@$(MAKE) run-scrape SITE=aicasebook CMD=$*

up-%:
	@$(MAKE) run-scrape SITE=uppity CMD=$*

mj-%:
	@$(MAKE) run-scrape SITE=maily_josh CMD=$*

yz-%:
	@$(MAKE) run-scrape SITE=yozm CMD=$*

li-%:
	@$(MAKE) run-scrape SITE=linkedin CMD=$*

# run-scrape (moved from root Makefile)
PAGE       ?= 1
LIST_SLACK ?= 2

run-scrape:
	@if [ "$(CMD)" = "list" ]; then \
		$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npm run scrape:$(SITE):list -- --page "$(PAGE)" --list-slack "$(LIST_SLACK)"; \
	elif [ "$(CMD)" = "refresh-urls" ]; then \
		$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npm run scrape:$(SITE):refresh-urls; \
	elif [ "$(CMD)" = "refresh-silver" ]; then \
		$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npm run scrape:$(SITE):refresh-silver; \
	else \
		echo "Unknown command: $(CMD)"; \
		exit 1; \
	fi

# tests (forward to npm scripts)
test-urls:
	$(COMPOSE) run --rm $(RUN_USER) worker npm run test:urls

test-mcp:
	$(COMPOSE) run --rm $(RUN_USER) viewer npm run test:mcp

test-sites:
	$(COMPOSE) run --rm $(RUN_USER) worker npm run test:sites

test-%:
	$(COMPOSE) run --rm $(RUN_USER) -e SITE=$(SITE) worker npm run test:$*

extract:
	@if [ -z "$(SITE)" ] || [ -z "$(ID)" ]; then \
		echo "❌ Error: SITE and ID variables must be specified. (e.g. make extract SITE=yozm ID=3800)"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm $(RUN_USER) worker npm run extract:article -- --site $(SITE) --id $(ID)

debug:
	@if [ -z "$(FILE)" ] && ([ -z "$(SITE)" ] || [ -z "$(ID)" ]); then \
		echo "❌ Error: Either FILE, or SITE and ID variables must be specified."; \
		echo "Usage 1: make debug FILE=tests/sites/yozm/fixtures/3800.html"; \
		echo "Usage 2: make debug SITE=yozm ID=3800"; \
		exit 1; \
	fi
	@if [ -n "$(FILE)" ]; then \
		$(COMPOSE) run --rm $(RUN_USER) worker npm run debug:html -- --file $(FILE); \
	else \
		$(COMPOSE) run --rm $(RUN_USER) worker npm run debug:html -- --site $(SITE) --id $(ID); \
	fi

# gmail tools
gmail-sync:
	$(COMPOSE) run --rm $(RUN_USER) -v $(ROOT_DIR)/data/gmail:/data gmail npm run gmail:sync

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
