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

# crawler app forwarding
list refresh-urls refresh-silver rebuild restart clear-queue grep-errors dump-queue fix-urls get-queue-status extract debug test-%:
	@$(MAKE) -C apps/crawler $@

gm-%:
	@$(MAKE) -C apps/crawler gmail-$*

gpt-% gn-% ddds-% pk-% ab-% up-% mj-% yz-% li-%:
	@$(MAKE) -C apps/crawler $@

# db utils
mongo-%:
	@$(MAKE) -f scripts/utils/mongo.mk $*

# agent utils
agents-%:
	@$(MAKE) -f scripts/agents/agents.mk $*

# meili utils
ms-%:
	@$(MAKE) -f scripts/utils/meili.mk $*

# ebook utils
ebook-%:
	@$(MAKE) -C apps/ebook $* PDF="$(PDF)" RANGE="$(RANGE)" OUT="$(OUT)"

# viewer utils
viewer-%:
	@$(MAKE) -C apps/viewer $*



