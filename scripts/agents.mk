# ==============================================================================
# 🤖 Agent Infrastructure Management Makefile (scripts/agents.mk)
# ==============================================================================
# Design Context: Router for managing agent transcripts, contexts, and usage diagnostics.
# Constraints:    Requires execute permissions on all helper scripts in scripts/agents/.
# Dependencies:   make, ts-node, bash, usage.ts
# ==============================================================================

AGENTS ?= agy
AGENTS_FLAG = --agent=$(AGENTS)

.PHONY: agents-get-agy-token \
        agents-dump-transcripts \
        agents-dump-context \
        agents-dump-brain \
        agents-dump-sysinfo \
        agents-compress-rules \
        agents-lint-rules \
        agents-usage \
        agents-prune \
        agents-dump-all \
        agents-commit

agents-get-agy-token:
	@PORT=$$(echo $${ANTIGRAVITY_LS_ADDRESS} | cut -d':' -f2); \
	if [ -z "$$PORT" ]; then PORT="46177"; fi; \
	echo "ANTIGRAVITY_BASE_URL=http://host.docker.internal:$$PORT"; \
	echo "ANTIGRAVITY_CSRF_TOKEN=$${ANTIGRAVITY_CSRF_TOKEN}"

agents-dump-transcripts:
	@npx ts-node src/tools/agents/dump_transcript.ts --all $(AGENTS_FLAG)

agents-dump-context:
	@npx ts-node src/tools/agents/dump_context.ts --all $(AGENTS_FLAG)

agents-dump-brain:
	@npx ts-node src/tools/agents/dump_brain.ts --all $(AGENTS_FLAG)

agents-dump-sysinfo:
	@npx ts-node src/tools/agents/dump_sysinfo.ts

agents-compress-rules:
	@npx ts-node src/tools/agents/dump_context.ts --all $(AGENTS_FLAG)
	@npx ts-node src/tools/agents/compress_rules.ts

agents-lint-rules:
	@npx ts-node src/tools/agents/lint_rules.ts

agents-usage:
	@npx ts-node src/tools/agents/usage.ts

agents-prune:
	@npx ts-node src/tools/agents/prune_session.ts

agents-dump-all: agents-dump-sysinfo agents-dump-transcripts agents-dump-context agents-dump-brain agents-compress-rules agents-lint-rules

agents-commit:
	@bash scripts/agents/commit-changes.sh
