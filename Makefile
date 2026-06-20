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

# sites & crawler forwarding
list refresh-urls refresh-silver:
	@$(MAKE) -C apps/crawler $@

gpt-% gn-% ddds-% pk-% ab-% up-% mj-% yz-% li-%:
	@$(MAKE) -C apps/crawler $@

# tests & utils forwarding
test-%:
	@$(MAKE) -C apps/crawler $@ RECURSIVE_SCRAPE="$(RECURSIVE_SCRAPE)" SITE="$(SITE)"

extract debug:
	@$(MAKE) -C apps/crawler $@ SITE="$(SITE)" ID="$(ID)" FILE="$(FILE)"

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

viewer-%:
	@$(MAKE) -C apps/viewer $*

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



