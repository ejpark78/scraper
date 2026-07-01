# ==============================================================================
# 🤖 Design Context & Constraints (AGENTS.md Compliance)
# ==============================================================================
# @module Makefile
# @description Entrypoint for CLI tasks. Routes site scraper runs, testing, and db utils.
# @constraints
#   - Do NOT execute make commands or custom bash scripts without explicit user permission.
#   - Integrates environment vars from `scripts/environments.mk`.
#   - Includes site-specific sub-makefiles (gpters, geeknews, dailydoseofds, etc.).
# @dependencies GNU Make, docker compose, scripts/**/*.mk
# @lastUpdated 2026-06-11
# ==============================================================================

include docker/environments.mk

COMPOSE := HOST_PROJECT_PATH=$(shell pwd) docker compose -p scraper
export COMPOSE

# RUN_USER and others are now defined in environments.mk
.PHONY: *

lint:
	$(COMPOSE) run --rm $(RUN_USER) worker npx yaml-lint compose.yml "docker/**/*.yml"

mkcert:
	@echo "🔐 Traefik 로컬 인증서를 호스트에서 생성합니다..."
	@command -v mkcert >/dev/null 2>&1 || { echo "❌ 호스트에 mkcert가 설치되어 있지 않습니다."; exit 1; }
	@mkcert -install
	@mkdir -p data/.services/traefik/certs
	@mkcert -cert-file data/.services/traefik/certs/local-cert.pem -key-file data/.services/traefik/certs/local-key.pem localhost gitea.localhost route.localhost viewer.localhost docs.localhost me.localhost redis.localhost search.localhost "*.localhost" 127.0.0.1
	@echo "✅ Traefik 인증서 생성이 완료되었습니다."

-include docker/browser.mk
-include docker/docker.mk
-include docker/tools/tools.mk

# crawler app forwarding
list refresh-urls refresh-silver rebuild restart clear-queue grep-errors dump-queue fix-urls get-queue-status extract debug:
	@$(MAKE) -C apps/crawler $@

test-%:
	@$(MAKE) -C apps/crawler $@

gm-%:
	@$(MAKE) -C apps/crawler gmail-$*

gpt-% gn-% ddds-% pk-% ab-% up-% mj-% yz-% li-%:
	@$(MAKE) -C apps/crawler $@

# db utils
mongo-%:
	@$(MAKE) -f docker/infra/mongodb/mongo.mk $*

# agent utils
agents-%:
	@$(MAKE) -f .agents/scripts/agents.mk $*

# meili utils
ms-%:
	@$(MAKE) -f docker/infra/meilisearch/meili.mk $*

# ebook utils
ebook-%:
	@$(MAKE) -C apps/ebook $* PDF="$(PDF)" RANGE="$(RANGE)" OUT="$(OUT)"

# viewer utils
viewer-%:
	@$(MAKE) -C apps/viewer $*

# openkb utils
openkb-%:
	@$(MAKE) -C apps/openkb $* MODEL="$(MODEL)" RAW="$(RAW)" SAMPLE="$(SAMPLE)"
