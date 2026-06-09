# ==============================================================================
# ✉️ Gmail Bulk Export Commands
# ==============================================================================

.PHONY: run

run:
	$(COMPOSE) run --rm $(RUN_USER) gmail npx ts-node src/tools/gmail/gmail.ts
