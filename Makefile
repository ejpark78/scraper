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

COMPOSE := docker compose -p linkedin
export COMPOSE

# RUN_USER and others are now defined in environments.mk

.PHONY: *

lint:
	$(COMPOSE) run --rm $(RUN_USER) base npx yaml-lint compose.yml "docker/**/*.yml"

-include scripts/utils/browser.mk
-include scripts/utils/docker.mk
-include scripts/utils/pipeline.mk
-include scripts/tools/tools.mk

list: RECURSIVE_SCRAPE=true
list: gpt-list gn-list ddds-list pk-list ab-list up-list mj-list yz-list 

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

test-%:
	@$(MAKE) -f scripts/utils/tests.mk $*

mongo-%:
	@$(MAKE) -f scripts/utils/mongo.mk $*

gm-%:
	@$(MAKE) -f scripts/tools/gmail.mk $*
