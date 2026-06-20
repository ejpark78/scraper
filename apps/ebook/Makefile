# Dynamic detection of project root path via Make functions
ROOT_DIR := $(realpath $(dir $(lastword $(MAKEFILE_LIST)))../..)

COMPOSE := docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml

RUN_USER ?= --user $$(id -u):$$(id -g)
OUTPUT ?= output

.PHONY: build summary analyze split pdf2md pdf2html translate_md html2md translate_batch shell test

build:
	$(COMPOSE) build --no-cache ebook

summary:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe summary

analyze:
	@if [ -z "$(PDF)" ]; then \
		echo "Usage: make analyze PDF=<path_to_pdf>"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe analyze "$(PDF)"

split:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe split

pdf2md:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe pdf2md

pdf2html:
	@if [ -z "$(PDF)" ]; then \
		$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe pdf2html --path "$(OUTPUT)"; \
	else \
		$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe pdf2html "$(PDF)" --path "$(OUTPUT)"; \
	fi

translate_md:
	@if [ -z "$(PDF)" ] || [ -z "$(RANGE)" ] || [ -z "$(OUT)" ]; then \
		echo "Usage: make translate_md PDF=<path_to_pdf> RANGE=<start-end> OUT=<output_base>"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe translate_md "$(PDF)" --translate-pages "$(RANGE)" --translate-out "$(OUT)"

html2md:
	@if [ -z "$(HTML)" ]; then \
		$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe html2md --path "$(OUTPUT)"; \
	else \
		$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe html2md "$(HTML)" --path "$(OUTPUT)"; \
	fi

translate_batch:
	@if [ -z "$(INPUT_DIR)" ]; then \
		echo "Usage: make translate_batch INPUT_DIR=<dir> [PROVIDER=gemini] [MODEL=...]"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm $(RUN_USER) -e GEMINI_API_KEY -e OPENAI_API_KEY ebook uv run poe translate_batch --input-dir "$(INPUT_DIR)" $(PROVIDER:%=--provider %) $(MODEL:%=--model %)

shell:
	$(COMPOSE) run --rm $(RUN_USER) ebook bash

test:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe test
