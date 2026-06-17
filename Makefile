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
	@$(MAKE) -f scripts/sites/gpters.mk $*

gn-%:
	@$(MAKE) -f scripts/sites/geeknews.mk $*

ddds-%:
	@$(MAKE) -f scripts/sites/dailydoseofds.mk $*

pk-%:
	@$(MAKE) -f scripts/sites/pytorch_kr.mk $*

ab-%:
	@$(MAKE) -f scripts/sites/aicasebook.mk $*

up-%:
	@$(MAKE) -f scripts/sites/uppity.mk $*

mj-%:
	@$(MAKE) -f scripts/sites/maily_josh.mk $*

yz-%:
	@$(MAKE) -f scripts/sites/yozm.mk $*

li-%:
	@$(MAKE) -f scripts/sites/linkedin.mk $*

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
	@$(MAKE) -f scripts/utils/agents.mk $*

# meili utils
ms-%:
	@$(MAKE) -f scripts/utils/meili.mk $*
