# ==============================================================================
# 🐳 Docker Infrastructure Control Commands
# ==============================================================================

.PHONY: build up down kasm

build:
	$(COMPOSE) --profile runtime build

up:
	$(COMPOSE) up -d
	@echo "🚀 모든 서비스와 어드민 도구가 성공적으로 실행되었습니다."

down:
	$(COMPOSE) --profile tools down || true
	@echo "🛑 모든 서비스가 종료되었습니다."

kasm:
	$(COMPOSE) exec -it kasm /bin/zsh
