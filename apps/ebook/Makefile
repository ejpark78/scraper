# Dynamic detection of project root path via Make functions
ROOT_DIR := $(realpath $(dir $(lastword $(MAKEFILE_LIST)))../..)

COMPOSE := docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml

RUN_USER ?= --user $$(id -u):$$(id -g)
OUT_PATH ?= data/output
RAW ?= data/raw

.PHONY: build summary analyze split to-html to-md shell test

build:
	$(COMPOSE) build --no-cache ebook

summary:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe summary --path "$(OUT_PATH)"

OVERWRITE_FLAG := $(if $(filter true,$(OVERWRITE)),--overwrite,)

analyze:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe analyze --raw "$(RAW)" $(OVERWRITE_FLAG)

split:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe split --raw "$(RAW)" --path "$(OUT_PATH)"

to-html:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe to-html --path "$(OUT_PATH)"

to-md:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe to-md --path "$(OUT_PATH)"

shell:
	$(COMPOSE) run --rm $(RUN_USER) ebook bash

test:
	$(COMPOSE) run --rm $(RUN_USER) ebook uv run poe test
