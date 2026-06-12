# ==============================================================================
# 🤖 Agent Infrastructure Management Makefile (scripts/agents.mk)
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
        commit

dump:
	@npx ts-node src/tools/agents/dump.ts --all-targets --all $(AGENTS_FLAG)
	@$(MAKE) -f scripts/utils/agents.mk compress-rules

dump-transcripts:
	@npx ts-node src/tools/agents/dump.ts --transcript --all $(AGENTS_FLAG)

dump-context:
	@npx ts-node src/tools/agents/dump.ts --context --all $(AGENTS_FLAG)

dump-brain:
	@npx ts-node src/tools/agents/dump.ts --brain --all $(AGENTS_FLAG)

dump-sysinfo:
	@npx ts-node src/tools/agents/dump.ts --sysinfo

compress-rules:
	@npx ts-node src/tools/agents/dump.ts --context --all $(AGENTS_FLAG)
	@npx ts-node src/tools/agents/rules.ts --compress

lint-rules:
	@npx ts-node src/tools/agents/rules.ts --lint

usage:
	@npx ts-node src/tools/agents/usage.ts

prune:
	@npx ts-node src/tools/agents/prune_session.ts

commit:
	@bash scripts/agents/commit-changes.sh
