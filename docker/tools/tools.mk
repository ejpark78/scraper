# ==============================================================================
# 🗄️ Tools & Coding Agents (scripts/tools/tools.mk)
# ==============================================================================
# Design Context: Makefile commands to control developer tools and coding agents.
# Constraints:    All Web GUI tools route through Traefik proxy on port 80/443.
# Dependencies:   make, docker-compose, traefik
# ==============================================================================

.PHONY: *

# --- Infrastructure Tools ---

up-tools: up-kasm up-mongo up-redis up-yacht up-dozzle up-cronicle up-jupyter up-gitea
	@echo "✅ 모든 Tools가 실행되었습니다."

down-tools:
	$(COMPOSE) --profile tools down traefik kasm mongo-express redisinsight yacht dozzle cronicle jupyter gitea
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


# --- Coding Agents ---

opencode:
	$(COMPOSE) --profile tools run --rm $(RUN_USER) opencode

ollama:
	ollama launch opencode --model gemma4:31b-cloud

# --- Gitea Token Utilities ---

gitea-token-curl:
	@echo "🔑 Gitea API를 통해 신규 토큰을 발급합니다..."
	@curl -s -k -X POST -u "gitea-admin:admin12345" \
		-H "Content-Type: application/json" \
		-d '{"name":"antigravity-token-$$(shell date +%s)","scopes":["all"]}' \
		"https://gitea.localhost/api/v1/users/gitea-admin/tokens" | grep -o '"sha1":"[^"]*' | cut -d'"' -f4 || echo "❌ 토큰 생성 실패"

gitea-token-tea:
	@echo "🍵 tea CLI 로그인 설정을 추가하고 토큰을 확인합니다..."
	@tea login add --name local-gitea --url https://gitea.localhost --username gitea-admin --password admin12345 --insecure --insecure-skip-verify || true
	@echo "🔑 생성된 tea API 토큰:"
	@cat ~/.config/tea/config.yml 2>/dev/null | grep -A 5 "local-gitea" || echo "❌ tea 설정 파일을 읽을 수 없습니다."

