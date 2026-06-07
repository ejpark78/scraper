# ==============================================================================
# 🤖 Agent Infrastructure Management Makefile (.agents/Makefile)
# ==============================================================================

.PHONY: dump-transcripts dump-context dump-brain

dump-transcripts:
	@npx ts-node .agents/scripts/dump_transcript.ts --all

dump-context:
	@npx ts-node .agents/scripts/dump_context.ts --all

dump-brain:
	@npx ts-node .agents/scripts/dump_brain.ts --all

dump-sysinfo:
	@npx ts-node .agents/scripts/dump_sysinfo.ts

compress-rules:
	@npx ts-node .agents/scripts/compress_rules.ts

lint-rules:
	@npx ts-node .agents/scripts/lint_rules.ts

dump-all: dump-sysinfo dump-transcripts dump-context dump-brain compress-rules lint-rules





