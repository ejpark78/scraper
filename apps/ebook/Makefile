# Dynamic detection of project root path via Make functions
ROOT_DIR := $(realpath $(dir $(lastword $(MAKEFILE_LIST)))../..)

COMPOSE := docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml

RUN_USER ?= --user $$(id -u):$$(id -g)
OUTPUT ?= data/output
RAW ?= data/raw

.PHONY: build summary analyze split to-html to-md translate_md translate_batch shell test

build:
	$(COMPOSE) build --no-cache ebook

summary:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe summary --path "$(OUTPUT)"

analyze:
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make analyze FILE=<path>"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe analyze "$(FILE)"

split:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe split --raw "$(RAW)" --path "$(OUTPUT)"

to-html:
	@if [ -z "$(FILE)" ]; then \
		$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe to-html --path "$(OUTPUT)"; \
	else \
		$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe to-html "$(FILE)" --path "$(OUTPUT)"; \
	fi

to-md:
	@if [ -z "$(FILE)" ]; then \
		$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe to-md --path "$(OUTPUT)"; \
	else \
		$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe to-md "$(FILE)" --path "$(OUTPUT)"; \
	fi

translate_md:
	@if [ -z "$(PDF)" ] || [ -z "$(RANGE)" ] || [ -z "$(OUT)" ]; then \
		echo "Usage: make translate_md PDF=<path_to_pdf> RANGE=<start-end> OUT=<output_base>"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe translate_md "$(PDF)" --translate-pages "$(RANGE)" --translate-out "$(OUT)"

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
