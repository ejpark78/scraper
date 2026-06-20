# Makefile for apps/viewer (Runs Docker commands)

# Fallbacks for variables if not called from root Makefile
COMPOSE ?= docker compose -p scraper -f ../../compose.yml -f compose.yml

.PHONY: up down

up:
	$(COMPOSE) build --no-cache viewer-fe viewer-api viewer-mcp
	$(COMPOSE) up -d viewer-fe viewer-api viewer-mcp
	@echo "🚀 Viewer GUI가 실행되었습니다. https://viewer.localhost 에 접속하세요."

down:
	$(COMPOSE) down viewer-fe viewer-api viewer-mcp
	@echo "🛑 Viewer GUI 서비스가 중지되었습니다."
