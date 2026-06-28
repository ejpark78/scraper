# ==============================================================================
# 🤖 Agent Infrastructure Management Makefile (scripts/agents/agents.mk)
# ==============================================================================
# Design Context: Router for managing agent transcripts, contexts, and usage diagnostics.
# Constraints:    Requires execute permissions on all helper scripts in scripts/agents/.
# Dependencies:   make, ts-node, bash, usage.ts
# ==============================================================================

AGENTS ?= agy
AGENTS_FLAG = --agent=$(AGENTS)

 .PHONY: dump \
		dump-transcripts \
        dump-context \
        dump-brain \
        dump-sysinfo \
        compress-rules \
        squash \
        usage \
        prune \
        commit

dump:
	@npx ts-node --project apps/agents/tsconfig.json apps/agents/sessions.ts --all-targets --all $(AGENTS_FLAG)
	@$(MAKE) -f .agents/scripts/agents.mk compress-rules

dump-transcripts:
	@npx ts-node --project apps/agents/tsconfig.json apps/agents/sessions.ts --transcript --all $(AGENTS_FLAG)

dump-context:
	@npx ts-node --project apps/agents/tsconfig.json apps/agents/sessions.ts --context --all $(AGENTS_FLAG)

dump-brain:
	@npx ts-node --project apps/agents/tsconfig.json apps/agents/sessions.ts --brain --all $(AGENTS_FLAG)

dump-sysinfo:
	@npx ts-node --project apps/agents/tsconfig.json apps/agents/sessions.ts --sysinfo

compress-rules:
	@npx ts-node --project apps/agents/tsconfig.json apps/agents/sessions.ts --context --all $(AGENTS_FLAG)
	@npx ts-node --project apps/agents/tsconfig.json apps/agents/rules.ts --compress

squash:
	@bash .agents/scripts/squash-artifacts.sh

lint-rules:
	@npx ts-node --project apps/agents/tsconfig.json apps/agents/rules.ts --lint

usage:
	@npx ts-node --project apps/agents/tsconfig.json apps/agents/usage.ts

prune:
	@npx ts-node --project apps/agents/tsconfig.json apps/agents/sessions.ts --prune

commit:
	@bash .agents/scripts/commit-changes.sh

code-review review:
	@echo "🤖 Running AI Code Review Skill via Antigravity CLI..."
	@agy --skill code_review "Run semantic code review on my latest modifications."

push:
	@bash .agents/scripts/push-changes.sh

pms:
	@npx ts-node .agents/scripts/sync-pms.ts

pms-reset:
	@npx ts-node .agents/scripts/sync-pms.ts --reset

pms-token:
	@echo "=============================================================================="
	@echo "⚙️  Gitea & Vikunja PMS 동기화용 환경 변수 설정 안내"
	@echo "아래 텍스트 블록을 복사하여 프로젝트 최상위의 .env 파일에 추가해 주십시오."
	@echo "=============================================================================="
	@echo ""
	@echo "GITEA_API_URL=https://gitea.127.0.0.1.nip.io/api/v1"
	@sqlite3 data/.services/gitea/gitea/gitea.db "DELETE FROM access_token WHERE name='agents-pms-sync';" 2>/dev/null || true
	@g_tok=$$(docker compose -p scraper exec -it gitea gitea admin user generate-access-token --username gitea-admin --token-name agents-pms-sync --scopes all 2>/dev/null | grep -o 'Access token was successfully created:.*' | cut -d' ' -f6 | tr -d '\r' | tr -d '\n'); \
	 if [ -n "$$g_tok" ]; then \
	   echo "GITEA_API_TOKEN=$$g_tok"; \
	 else \
	   echo "GITEA_API_TOKEN=기존_발행된_Gitea_토큰_값 (토큰 재생성 실패)"; \
	 fi
	@echo "VIKUNJA_API_URL=https://vikunja.127.0.0.1.nip.io/api/v1"
	@v_tok=$$(curl -k -s -X POST https://vikunja.127.0.0.1.nip.io/api/v1/login \
	   -H "Content-Type: application/json" \
	   -d '{"username": "vikunja-admin", "password": "admin12345"}' | tr -d '\r' | tr -d '\n' | sed 's/.*"token":"\([^"]*\)".*/\1/'); \
	 if [ -n "$$v_tok" ]; then \
	   echo "VIKUNJA_API_TOKEN=$$v_tok"; \
	 else \
	   echo "VIKUNJA_API_TOKEN=Vikunja_로그인_실패"; \
	 fi
	@echo ""
	@echo "=============================================================================="














