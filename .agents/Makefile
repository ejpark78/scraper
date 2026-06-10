# ==============================================================================
# 🤖 Agent Infrastructure Management Makefile (.agents/Makefile)
# ==============================================================================
# Design Context: Main router for managing agent transcripts, contexts, and usage diagnostics.
# Constraints:    Requires execute permissions on all helper scripts in .agents/scripts/.
# Dependencies:   make, ts-node, bash, usage.ts
# ==============================================================================
# Usage:
#   make -f .agents/Makefile <TARGET>             # agy only (default)
#   make -f .agents/Makefile AGENTS=opencode <T>
#   make -f .agents/Makefile AGENTS=agy,opencode <T>

AGENTS ?= agy

.PHONY: dump-transcripts dump-context dump-brain prune usage get-agy-token

AGENTS_FLAG = --agent=$(AGENTS)

get-agy-token:
	@PORT=$$(echo $${ANTIGRAVITY_LS_ADDRESS} | cut -d':' -f2); \
	if [ -z "$$PORT" ]; then PORT="46177"; fi; \
	echo "ANTIGRAVITY_BASE_URL=http://host.docker.internal:$$PORT"; \
	echo "ANTIGRAVITY_CSRF_TOKEN=$${ANTIGRAVITY_CSRF_TOKEN}"

dump-transcripts:
	@npx ts-node .agents/scripts/dump_transcript.ts --all $(AGENTS_FLAG)

dump-context:
	@npx ts-node .agents/scripts/dump_context.ts --all $(AGENTS_FLAG)

dump-brain:
	@npx ts-node .agents/scripts/dump_brain.ts --all $(AGENTS_FLAG)

dump-sysinfo:
	@npx ts-node .agents/scripts/dump_sysinfo.ts

compress-rules:
	@npx ts-node .agents/scripts/compress_rules.ts

lint-rules:
	@npx ts-node .agents/scripts/lint_rules.ts

usage:
	@npx ts-node .agents/scripts/usage.ts

prune:
	@npx ts-node .agents/scripts/prune_session.ts

dump-all: dump-sysinfo dump-transcripts dump-context dump-brain compress-rules lint-rules
