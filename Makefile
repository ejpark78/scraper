# ==============================================================================
# ⚙️ LinkedIn Scraper Makefile (Command Interface Router)
# ==============================================================================

COMPOSE := docker compose -p linkedin
export COMPOSE

RUN_USER := --user $(shell id -u):$(shell id -g)
export RUN_USER

.PHONY: test lint

# --- 1. explicit local & data-level targets ---
test:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node tests/url_manager.test.ts

lint:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx yaml-lint compose.yml "docker/**/*.yml"

# --- 2. include common and helper scripts directly (browser.mk, docker.mk, mongo.mk) ---
-include scripts/*.mk

# --- 3. delegate site-specific commands to prevent target name conflicts ---
li-%:
	@$(MAKE) -f scripts/sites/linkedin.mk $*

gpters-%:
	@$(MAKE) -f scripts/sites/gpters.mk $*

geeknews-%:
	@$(MAKE) -f scripts/sites/geeknews.mk $*

pytorch-%:
	@$(MAKE) -f scripts/sites/pytorch_kr.mk $*
