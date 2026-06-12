# ==============================================================================
# ✉️ Gmail Bulk Export Commands
# ==============================================================================

.PHONY: dump

DATA_MOUNT ?= -v ./data/gmail:/data

dump:
	$(COMPOSE) run --rm $(RUN_USER) $(DATA_MOUNT) gmail npx ts-node src/tools/gmail/gmail.ts
