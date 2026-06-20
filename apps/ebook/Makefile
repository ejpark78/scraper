# Dynamic detection of project root path via Make functions
ROOT_DIR := $(realpath $(dir $(lastword $(MAKEFILE_LIST)))../..)

COMPOSE := docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml

.PHONY: build summary analyze split md html translate

build:
	$(COMPOSE) build

summary:
	$(COMPOSE) run --rm ebook uv run poe summary

analyze:
	@if [ -z "$(PDF)" ]; then \
		echo "Usage: make analyze PDF=<path_to_pdf>"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm ebook uv run poe analyze "$(PDF)"
	
split:
	$(COMPOSE) run --rm ebook uv run poe split

md:
	$(COMPOSE) run --rm ebook uv run poe md

html:
	@if [ -z "$(PDF)" ]; then \
		echo "Usage: make html PDF=<path_to_pdf>"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm ebook uv run poe html "$(PDF)"

translate:
	@if [ -z "$(PDF)" ] || [ -z "$(RANGE)" ] || [ -z "$(OUT)" ]; then \
		echo "Usage: make translate PDF=<path_to_pdf> RANGE=<start-end> OUT=<output_base>"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm ebook uv run poe translate "$(PDF)" --translate-pages "$(RANGE)" --translate-out "$(OUT)"
