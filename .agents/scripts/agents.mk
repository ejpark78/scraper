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
        usage \
        prune \
        commit \
        wiki

dump:
	@npx ts-node --project apps/agents/tsconfig.json apps/agents/sessions.ts --all-targets --all $(AGENTS_FLAG)
	@$(MAKE) -f .agents/scripts/agents.mk compress-rules
	@$(MAKE) -f .agents/scripts/agents.mk wiki

wiki:
	@bash .agents/scripts/sync-wiki.sh

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















