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
	@npm run agents:sessions -- --all-targets --all $(AGENTS_FLAG)
	@$(MAKE) -f .agents/scripts/agents.mk compress-rules
	@npm run openkb
	@npm run wiki

wiki:
	@npm run wiki

dump-transcripts:
	@npm run agents:sessions -- --transcript --all $(AGENTS_FLAG)

dump-context:
	@npm run agents:sessions -- --context --all $(AGENTS_FLAG)

dump-brain:
	@npm run agents:sessions -- --brain --all $(AGENTS_FLAG)

dump-sysinfo:
	@npm run agents:sessions -- --sysinfo

compress-rules:
	@npm run agents:sessions -- --context --all $(AGENTS_FLAG)
	@npm run agents:rules -- --compress

lint-rules:
	@npm run agents:rules -- --lint

usage:
	@npm run agents:usage

prune:
	@npm run agents:sessions -- --prune

commit:
	@npm run commit

code-review review:
	@echo "🤖 Running AI Code Review Skill via Antigravity CLI..."
	@agy --skill code_review "Run semantic code review on my latest modifications."

push:
	@npm run push















