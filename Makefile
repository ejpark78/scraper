# ==============================================================================
# 🤖 Design Context & Constraints (AGENTS.md Compliance)
# ==============================================================================
# @module Makefile
# @description Entrypoint for CLI tasks. Routes site scraper runs, testing, and db utils.
# @constraints
#   - Do NOT execute make commands or custom bash scripts without explicit user permission.
#   - Integrates environment vars from `scripts/environments.mk`.
#   - Includes site-specific sub-makefiles (gpters, geeknews, dailydoseofds, etc.).
# @dependencies GNU Make, docker compose, scripts/**/*.mk
# @lastUpdated 2026-06-11
# ==============================================================================

include scripts/environments.mk

COMPOSE := docker compose -p scraper
export COMPOSE

# RUN_USER and others are now defined in environments.mk

.PHONY: *

lint:
	$(COMPOSE) run --rm $(RUN_USER) worker npx yaml-lint compose.yml "docker/**/*.yml"

-include scripts/utils/browser.mk
-include scripts/utils/docker.mk
-include scripts/utils/worker.mk
-include scripts/tools/tools.mk

# sites grouped targets
list: RECURSIVE_SCRAPE=true
list: gpt-list gn-list ddds-list pk-list ab-list up-list mj-list yz-list 

refresh-urls: RECURSIVE_SCRAPE=true
refresh-urls: gpt-refresh-urls gn-refresh-urls ddds-refresh-urls pk-refresh-urls ab-refresh-urls up-refresh-urls mj-refresh-urls yz-refresh-urls 

refresh-silver: RECURSIVE_SCRAPE=true
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

# tests
test-%:
	@$(MAKE) -f scripts/utils/tests.mk $*

extract:
	@$(MAKE) -f scripts/utils/tests.mk extract SITE=$(SITE) ID=$(ID)

debug:
	@$(MAKE) -f scripts/utils/tests.mk debug FILE=$(FILE) SITE=$(SITE) ID=$(ID)

# db utils
mongo-%:
	@$(MAKE) -f scripts/utils/mongo.mk $*

# gmail tools
gm-%:
	@$(MAKE) -f scripts/tools/gmail.mk $*

# agent utils
agents-%:
	@$(MAKE) -f scripts/agents/agents.mk $*

# meili utils
ms-%:
	@$(MAKE) -f scripts/utils/meili.mk $*

# ebook utils
ebook-%:
	@$(MAKE) -C apps/ebook $* PDF="$(PDF)" RANGE="$(RANGE)" OUT="$(OUT)"

