# Dynamic detection of project root path via Make functions
ROOT_DIR := $(realpath $(dir $(lastword $(MAKEFILE_LIST)))../..)

COMPOSE := docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml

RUN_USER ?= --user $$(id -u):$$(id -g)

.PHONY: build compile wiki shell lint format type-check

build:
	$(COMPOSE) build openkb

compile:
	$(COMPOSE) run --rm $(RUN_USER) --entrypoint poe openkb -C /app compile

wiki:
	$(COMPOSE) run --rm $(RUN_USER) --entrypoint poe openkb -C /app wiki

shell:
	$(COMPOSE) run --rm $(RUN_USER) --entrypoint bash openkb

lint:
	$(COMPOSE) run --rm $(RUN_USER) --entrypoint poe openkb -C /app lint

format:
	$(COMPOSE) run --rm $(RUN_USER) --entrypoint poe openkb -C /app format

type-check:
	$(COMPOSE) run --rm $(RUN_USER) --entrypoint poe openkb -C /app type-check
