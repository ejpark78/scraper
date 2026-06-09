# ==============================================================================
# ⚙️ LinkedIn Scraper Makefile (Command Interface Router)
# ==============================================================================

COMPOSE := docker compose -p linkedin
export COMPOSE

RUN_USER := --user $(shell id -u):$(shell id -g)
export RUN_USER

.PHONY: *

lint:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx yaml-lint compose.yml "docker/**/*.yml"

-include scripts/utils/browser.mk
-include scripts/utils/docker.mk
-include scripts/utils/pipeline.mk
-include scripts/tools/tools.mk

list: li-list gpt-list gn-list pk-list ab-list

test-%:
	@$(MAKE) -f scripts/utils/tests.mk $*

gm-%:
	@$(MAKE) -f scripts/tools/gmail.mk $*

li-%:
	@$(MAKE) -f scripts/sites/linkedin.mk $*

gpt-%:
	@$(MAKE) -f scripts/sites/gpters.mk $*

gn-%:
	@$(MAKE) -f scripts/sites/geeknews.mk $*

pk-%:
	@$(MAKE) -f scripts/sites/pytorch_kr.mk $*

ab-%:
	@$(MAKE) -f scripts/sites/aicasebook.mk $*

mongo-%:
	@$(MAKE) -f scripts/utils/mongo.mk $*
