# ==============================================================================
# 🗄️ Tools & Coding Agents (scripts/tools/tools.mk)
# ==============================================================================
# Design Context: Makefile commands to control developer tools and coding agents.
# Constraints:    All Web GUI tools route through Traefik proxy on port 80/443.
# Dependencies:   make, docker-compose, traefik
# ==============================================================================

.PHONY: *

# --- Infrastructure Tools ---

up-tools: up-me up-redis up-gitea up-obsidian
	@echo "✅ 모든 Tools가 실행되었습니다."

down-tools:
	$(COMPOSE) --profile tools down traefik mongo-express redisinsight gitea obsidian
	@echo "🛑 Tools가 중지되었습니다."

up-me:
	$(COMPOSE) --profile tools up -d mongo-express
	@echo "🚀 Mongo Express GUI가 실행되었습니다. https://me.localhost 에 접속하세요."

up-redis:
	$(COMPOSE) --profile tools up -d redisinsight
	@echo "🚀 RedisInsight GUI가 실행되었습니다. https://redis.localhost 에 접속하세요."

up-gitea:
	$(COMPOSE) --profile tools up -d gitea
	@echo "⏳ Gitea 컨테이너가 안정화될 때까지 대기합니다..."
	@sleep 5
	@if ! $(COMPOSE) exec -T -u 1000 gitea gitea admin user list | grep -q "gitea-admin"; then \
		echo "⚙️ Gitea 초기 관리자(gitea-admin) 계정을 생성합니다..."; \
		$(COMPOSE) exec -T -u 1000 gitea gitea admin user create --admin --username gitea-admin --password admin12345 --email admin@example.com || true; \
	fi
	@echo "🚀 Gitea GUI가 실행되었습니다. https://gitea.localhost 에 접속하세요."

up-obsidian:
	$(COMPOSE) --profile tools up -d obsidian
	@echo "🚀 Obsidian GUI가 실행되었습니다. https://docs.localhost 에 접속하세요."

down-obsidian:
	$(COMPOSE) --profile tools down obsidian
	@echo "🛑 Obsidian GUI 서비스가 중지되었습니다."


# --- Coding Agents ---

# --- Native Ollama Control Commands ---

.PHONY: ollama-run ollama-logs ollama-ps ollama-stop

ollama-run:
	@echo "🚀 맥북 네이티브 Ollama App/Service 실행 및 gemma4:26b 실행..."
	@open -a Ollama 2>/dev/null || (pgrep -x "ollama" >/dev/null && echo "Ollama가 이미 실행 중입니다.") || echo "⚠️ Ollama 앱이 애플리케이션 디렉토리에 없습니다. 백그라운드 CLI 실행을 시도합니다."
	@sleep 2
	@ollama run gemma4:26b

ollama-logs:
	@echo "📋 맥북 네이티브 Ollama 로그를 조회합니다..."
	@if [ -f ~/Library/Logs/Ollama/app.log ]; then \
		tail -n 50 -f ~/Library/Logs/Ollama/app.log; \
	elif [ -f ~/.ollama/logs/server.log ]; then \
		tail -n 50 -f ~/.ollama/logs/server.log; \
	else \
		echo "❌ Ollama 로그 파일을 찾을 수 없습니다."; \
	fi

ollama-ps:
	@echo "📊 현재 메모리에 로드된 Ollama 모델 리스트:"
	@ollama ps

ollama-stop:
	@echo "🛑 맥북 네이티브 Ollama 프로세스를 중지합니다..."
	@killall Ollama || killall ollama || echo "실행 중인 Ollama가 없습니다."


# --- Gitea Token Utilities ---

gitea-token-curl:
	@echo "🔑 Gitea API를 통해 신규 토큰을 발급합니다..."
	@curl -s -k -u "gitea-admin:admin12345" \
		"https://gitea.localhost/api/v1/users/gitea-admin/tokens" \
		| grep -o '"id":[0-9]*' \
		| cut -d: -f2 \
		| while read -r token_id; do \
			[ -n "$$token_id" ] || continue; \
			curl -s -k -X DELETE -u "gitea-admin:admin12345" \
				"https://gitea.localhost/api/v1/users/gitea-admin/tokens/$$token_id" >/dev/null; \
		done
	@curl -s -k -X POST -u "gitea-admin:admin12345" \
		-H "Content-Type: application/json" \
		-d "{\"name\":\"antigravity-token-$$(date +%s)\",\"scopes\":[\"all\"]}" \
		"https://gitea.localhost/api/v1/users/gitea-admin/tokens" | grep -o '"sha1":"[^"]*' | cut -d'"' -f4 || echo "❌ 토큰 생성 실패"

gitea-token-tea:
	@echo "🍵 tea CLI 로그인 설정을 추가하고 토큰을 확인합니다..."
	@tea logins delete local-gitea >/dev/null 2>&1 || true
	@tea logins add --name local-gitea --url https://gitea.localhost --user gitea-admin --password admin12345 --insecure
	@echo "🔑 생성된 tea API 토큰:"
	@config_file="$${XDG_CONFIG_HOME:-$$HOME/.config}/tea/config.yml"; \
	if [ ! -f "$$config_file" ]; then config_file="$$HOME/Library/Application Support/tea/config.yml"; fi; \
	awk '$$1 == "-" && $$2 == "name:" { in_login = ($$3 == "local-gitea") } in_login && $$1 == "token:" { print $$2; found = 1; exit } END { if (!found) exit 1 }' "$$config_file" \
		|| echo "❌ tea 토큰을 확인할 수 없습니다."
