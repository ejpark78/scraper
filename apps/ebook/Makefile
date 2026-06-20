# Dynamic detection of project root path via Make functions
ROOT_DIR := $(realpath $(dir $(lastword $(MAKEFILE_LIST)))../..)

COMPOSE := docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml

OUTPUT ?= output

.PHONY: build summary analyze split pdf2md pdf2html translate_md html2md shell

build:
	$(COMPOSE) build --no-cache ebook

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

pdf2md:
	$(COMPOSE) run --rm ebook uv run poe pdf2md

pdf2html:
	@if [ -z "$(PDF)" ]; then \
		$(COMPOSE) run --rm ebook uv run poe pdf2html --output "$(OUTPUT)"; \
	else \
		$(COMPOSE) run --rm ebook uv run poe pdf2html "$(PDF)" --output "$(OUTPUT)"; \
	fi

translate_md:
	@if [ -z "$(PDF)" ] || [ -z "$(RANGE)" ] || [ -z "$(OUT)" ]; then \
		echo "Usage: make translate_md PDF=<path_to_pdf> RANGE=<start-end> OUT=<output_base>"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm ebook uv run poe translate_md "$(PDF)" --translate-pages "$(RANGE)" --translate-out "$(OUT)"

html2md:
	@if [ -z "$(HTML)" ]; then \
		$(COMPOSE) run --rm ebook uv run poe html2md --output "$(OUTPUT)"; \
	else \
		$(COMPOSE) run --rm ebook uv run poe html2md "$(HTML)" --output "$(OUTPUT)"; \
	fi

shell:
	$(COMPOSE) run --rm ebook bash
