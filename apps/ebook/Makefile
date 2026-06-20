# Dynamic detection of project root path via Make functions
ROOT_DIR := $(realpath $(dir $(lastword $(MAKEFILE_LIST)))../..)

COMPOSE := docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml

.PHONY: build summary analyze split md html translate

build:
	$(COMPOSE) build

summary:
	$(COMPOSE) run --rm ebook python src/process.py --summary

analyze:
	@if [ -z "$(PDF)" ]; then \
		echo "Usage: make analyze PDF=<path_to_pdf>"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm ebook python src/process.py --analyze "$(PDF)"
	
split:
	$(COMPOSE) run --rm ebook python src/process.py --split

md:
	$(COMPOSE) run --rm ebook python src/process.py --md

html:
	@if [ -z "$(PDF)" ]; then \
		echo "Usage: make html PDF=<path_to_pdf>"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm ebook python src/process.py --html "$(PDF)"

translate:
	@if [ -z "$(PDF)" ] || [ -z "$(RANGE)" ] || [ -z "$(OUT)" ]; then \
		echo "Usage: make translate PDF=<path_to_pdf> RANGE=<start-end> OUT=<output_base>"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm ebook python src/process.py --translate "$(PDF)" --translate-pages "$(RANGE)" --translate-out "$(OUT)"
