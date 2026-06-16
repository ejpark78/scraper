# ==============================================================================
# 🗄️ Tools & Coding Agents (scripts/tools/tools.mk)
# ==============================================================================
# Design Context: Makefile commands to control developer tools and coding agents.
# Constraints:    All Web GUI tools route through Traefik proxy on port 80/443.
# Dependencies:   make, docker-compose, traefik
# ==============================================================================

.PHONY: *

# --- Infrastructure Tools ---

up-tools: up-kasm up-mongo up-redis up-yacht up-dozzle up-cronicle up-jupyter
	@echo "✅ 모든 Tools가 실행되었습니다."

down-tools:
	$(COMPOSE) --profile tools down traefik kasm mongo-express redisinsight yacht dozzle cronicle jupyter
	@echo "🛑 Tools가 중지되었습니다."

up-kasm:
	$(COMPOSE) --profile tools up -d --build kasm
	@echo "🚀 KASM VDI가 실행되었습니다. https://kasm.localhost 에 접속하세요."

up-me:
	$(COMPOSE) --profile tools up -d mongo-express
	@echo "🚀 Mongo Express GUI가 실행되었습니다. https://me.localhost 에 접속하세요."

up-redis:
	$(COMPOSE) --profile tools up -d redisinsight
	@echo "🚀 RedisInsight GUI가 실행되었습니다. https://redis.localhost 에 접속하세요."

up-yacht:
	$(COMPOSE) --profile tools up -d yacht
	@echo "🚀 Yacht GUI가 실행되었습니다. https://yacht.localhost 에 접속하세요."

up-dozzle:
	$(COMPOSE) --profile tools up -d dozzle
	@echo "🚀 Dozzle GUI가 실행되었습니다. https://dozzle.localhost 에 접속하세요."

up-cronicle:
	$(COMPOSE) --profile tools up -d cronicle
	@echo "🚀 Cronicle GUI가 실행되었습니다. https://cron.localhost 에 접속하세요."

up-jupyter:
	$(COMPOSE) --profile tools up -d --build jupyter
	@echo "🚀 Jupyter GUI가 실행되었습니다. https://jupyter.localhost 에 접속하세요."

up-viewer:
	$(COMPOSE) --profile tools --profile viewer build --no-cache viewer-fe viewer-api viewer-mcp
	$(COMPOSE) --profile tools --profile viewer up -d viewer-fe viewer-api viewer-mcp
	@echo "🚀 Viewer GUI가 실행되었습니다. https://viewer.localhost 에 접속하세요."

up-onwatch:
	$(COMPOSE) --profile tools up -d onwatch
	@echo "🚀 onWatch GUI가 실행되었습니다. https://onwatch.localhost 에 접속하세요."

# --- Coding Agents ---

opencode:
	$(COMPOSE) --profile tools run --rm $(RUN_USER) opencode

ollama:
	ollama launch opencode --model gemma4:31b-cloud
