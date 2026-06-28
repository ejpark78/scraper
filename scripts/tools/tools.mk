# ==============================================================================
# 🗄️ Tools & Coding Agents (scripts/tools/tools.mk)
# ==============================================================================
# Design Context: Makefile commands to control developer tools and coding agents.
# Constraints:    All Web GUI tools route through Traefik proxy on port 80/443.
# Dependencies:   make, docker-compose, traefik
# ==============================================================================

.PHONY: *

# --- Infrastructure Tools ---

up-tools: up-kasm up-mongo up-redis up-yacht up-dozzle up-cronicle up-jupyter up-gitea up-vikunja
	@echo "✅ 모든 Tools가 실행되었습니다."

down-tools:
	$(COMPOSE) --profile tools down traefik kasm mongo-express redisinsight yacht dozzle cronicle jupyter gitea vikunja
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

up-gitea:
	$(COMPOSE) --profile tools up -d gitea
	@echo "⏳ Gitea 컨테이너가 안정화될 때까지 대기합니다..."
	@sleep 5
	@if ! $(COMPOSE) exec -T -u 1000 gitea gitea admin user list | grep -q "gitea-admin"; then \
		echo "⚙️ Gitea 초기 관리자(gitea-admin) 계정을 생성합니다..."; \
		$(COMPOSE) exec -T -u 1000 gitea gitea admin user create --admin --username gitea-admin --password admin12345 --email admin@example.com || true; \
	fi
	@echo "🚀 Gitea GUI가 실행되었습니다. https://gitea.localhost 에 접속하세요."

up-vikunja:
	$(COMPOSE) --profile tools up -d vikunja
# 	@echo "⏳ Vikunja 컨테이너가 안정화될 때까지 대기합니다..."
# 	@sleep 5
# 	@if ! $(COMPOSE) exec -T -u 1000 vikunja /app/vikunja/vikunja user list | grep -q "vikunja-admin"; then \
# 		echo "⚙️ Vikunja 초기 관리자(vikunja-admin) 계정을 생성합니다..."; \
# 		$(COMPOSE) exec -T -u 1000 vikunja /app/vikunja/vikunja user create --email admin@example.com --username vikunja-admin --password admin12345 || true; \
# 		$(COMPOSE) exec -T -u 1000 vikunja /app/vikunja/vikunja user set-admin vikunja-admin --admin || true; \
# 	fi
	@echo "🚀 Vikunja GUI가 실행되었습니다. https://vikunja.localhost 에 접속하세요."



# --- Coding Agents ---

opencode:
	$(COMPOSE) --profile tools run --rm $(RUN_USER) opencode

ollama:
	ollama launch opencode --model gemma4:31b-cloud
