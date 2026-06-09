# ==============================================================================
# 🗄️ Tools & Coding Agents
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
	$(COMPOSE) --profile tools up -d --build viewer
	@echo "🚀 Viewer GUI가 실행되었습니다. https://viewer.localhost 에 접속하세요."

# --- Coding Agents ---

opencode:
	$(COMPOSE) --profile tools run --rm $(RUN_USER) opencode
