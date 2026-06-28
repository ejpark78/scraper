# ==============================================================================
# 🐳 Docker Infrastructure Control Commands
# ==============================================================================

.PHONY: build up down kasm

BUILD_DATE := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
VCS_REF := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

build:
	BUILD_DATE=$(BUILD_DATE) VCS_REF=$(VCS_REF) $(COMPOSE) --profile runtime --profile tools --profile worker --profile viewer build --no-cache

up:
	$(COMPOSE) --profile worker up -d
	@echo "🚀 모든 서비스와 어드민 도구가 성공적으로 실행되었습니다."

down:
	$(COMPOSE) --profile '*' down || true
	@echo "🛑 모든 서비스가 종료되었습니다."

logs:
	$(COMPOSE) logs -f scraper converter

shell:
	$(COMPOSE) exec -it kasm /bin/zsh
