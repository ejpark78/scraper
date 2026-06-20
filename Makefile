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
	@$(MAKE) -C apps/crawler run-scrape SITE=gpters CMD=$* ENV_COMMON="$(ENV_COMMON)" RUN_USER="$(RUN_USER)"

gn-%:
	@$(MAKE) -C apps/crawler run-scrape SITE=geeknews CMD=$* ENV_COMMON="$(ENV_COMMON)" RUN_USER="$(RUN_USER)"

ddds-%:
	@$(MAKE) -C apps/crawler run-scrape SITE=dailydoseofds CMD=$* ENV_COMMON="$(ENV_COMMON)" RUN_USER="$(RUN_USER)"

pk-%:
	@$(MAKE) -C apps/crawler run-scrape SITE=pytorch_kr CMD=$* ENV_COMMON="$(ENV_COMMON)" RUN_USER="$(RUN_USER)"

ab-%:
	@$(MAKE) -C apps/crawler run-scrape SITE=aicasebook CMD=$* ENV_COMMON="$(ENV_COMMON)" RUN_USER="$(RUN_USER)"

up-%:
	@$(MAKE) -C apps/crawler run-scrape SITE=uppity CMD=$* ENV_COMMON="$(ENV_COMMON)" RUN_USER="$(RUN_USER)"

mj-%:
	@$(MAKE) -C apps/crawler run-scrape SITE=maily_josh CMD=$* ENV_COMMON="$(ENV_COMMON)" RUN_USER="$(RUN_USER)"

yz-%:
	@$(MAKE) -C apps/crawler run-scrape SITE=yozm CMD=$* ENV_COMMON="$(ENV_COMMON)" RUN_USER="$(RUN_USER)"

li-%:
	@$(MAKE) -C apps/crawler run-scrape SITE=linkedin CMD=$* ENV_COMMON="$(ENV_COMMON)" RUN_USER="$(RUN_USER)"

# tests
test-%:
	@$(MAKE) -C apps/crawler test-$* RECURSIVE_SCRAPE="$(RECURSIVE_SCRAPE)" SITE="$(SITE)"

extract:
	@$(MAKE) -C apps/crawler extract SITE=$(SITE) ID=$(ID)

debug:
	@$(MAKE) -C apps/crawler debug FILE=$(FILE) SITE=$(SITE) ID=$(ID)

# db utils
mongo-%:
	@$(MAKE) -f scripts/utils/mongo.mk $*

# gmail tools (forward to apps/crawler)
gm-%:
	@$(MAKE) -C apps/crawler gmail-$*

# agent utils
agents-%:
	@$(MAKE) -f scripts/agents/agents.mk $*

# meili utils
ms-%:
	@$(MAKE) -f scripts/utils/meili.mk $*

# ebook utils
ebook-%:
	@$(MAKE) -C apps/ebook $* PDF="$(PDF)" RANGE="$(RANGE)" OUT="$(OUT)"

# infra management
SCALE         ?= 1
rebuild:
	@$(MAKE) -C apps/crawler rebuild

restart:
	@$(MAKE) -C apps/crawler restart SCALE=$(SCALE)

# queue & utils (forward to apps/crawler)
clear-queue:
	@$(MAKE) -C apps/crawler clear-queue

grep-errors:
	@$(MAKE) -C apps/crawler grep-errors

dump-queue:
	@$(MAKE) -C apps/crawler dump-queue

fix-urls:
	@$(MAKE) -C apps/crawler fix-urls

get-queue-status:
	@$(MAKE) -C apps/crawler get-queue-status



