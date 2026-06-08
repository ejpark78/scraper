# ==============================================================================
# 🤖 Agent Infrastructure Management Makefile (.agents/Makefile)
# ==============================================================================
# Usage:
#   make -f .agents/Makefile <TARGET>             # agy only (default)
#   make -f .agents/Makefile AGENTS=opencode <T>
#   make -f .agents/Makefile AGENTS=agy,opencode <T>

AGENTS ?= agy

.PHONY: dump-transcripts dump-context dump-brain prune

AGENTS_FLAG = --agent=$(AGENTS)

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

prune:
	@npx ts-node .agents/scripts/prune_session.ts

dump-all: dump-sysinfo dump-transcripts dump-context dump-brain compress-rules lint-rules
