# ==============================================================================
# ⚙️ LinkedIn Scraper Makefile (Command Interface Router)
# ==============================================================================

COMPOSE := docker compose -p linkedin
export COMPOSE

RUN_USER := --user $(shell id -u):$(shell id -g)
export RUN_USER

.PHONY: *

# --- 1. explicit local & data-level targets ---
lint:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx yaml-lint compose.yml "docker/**/*.yml"

# --- 2. include common and helper scripts directly (browser.mk, docker.mk) ---
-include scripts/utils/browser.mk
-include scripts/utils/docker.mk
-include scripts/utils/pipeline.mk
-include scripts/utils/tools.mk

test-%:
	@$(MAKE) -f scripts/utils/tests.mk $*

# --- 3. delegate site-specific commands to prevent target name conflicts ---
li-%:
	@$(MAKE) -f scripts/sites/linkedin.mk $*

gpt-%:
	@$(MAKE) -f scripts/sites/gpters.mk $*

gn-%:
	@$(MAKE) -f scripts/sites/geeknews.mk $*

pk-%:
	@$(MAKE) -f scripts/sites/pytorch_kr.mk $*

mongo-%:
	@$(MAKE) -f scripts/utils/mongo.mk $*
