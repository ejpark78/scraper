# Makefile for apps/viewer (Runs Docker commands)

# Dynamic detection of project root path via Make functions
ROOT_DIR := $(realpath $(dir $(lastword $(MAKEFILE_LIST)))../..)

# Fallbacks for variables if not called from root Makefile
COMPOSE  ?= docker compose -p scraper --project-directory $(ROOT_DIR) -f $(ROOT_DIR)/compose.yml
RUN_USER ?= --user $$(id -u):$$(id -g)

.PHONY: up down

build:
	@echo "⚙️  Generating static sites configuration..."
	$(COMPOSE) run --rm $(RUN_USER) -v $(ROOT_DIR):/app worker npx ts-node apps/crawler/src/scripts/generate-sites-config.ts
	$(COMPOSE) build --no-cache viewer-fe viewer-api viewer-mcp
	@echo "🧹 Cleaning up temporary static sites configuration..."
	@rm -f $(ROOT_DIR)/apps/viewer/config/sites.json
	@echo "🚀 Viewer Build가 완료되었습니다."

up:
	$(COMPOSE) up -d viewer-fe viewer-api viewer-mcp
	@echo "🚀 Viewer GUI가 실행되었습니다. https://viewer.localhost 에 접속하세요."

down:
	$(COMPOSE) down viewer-fe viewer-api viewer-mcp
	@echo "🛑 Viewer GUI 서비스가 중지되었습니다."
