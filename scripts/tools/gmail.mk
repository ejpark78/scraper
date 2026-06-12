# ==============================================================================
# ✉️ Gmail Bulk Export Commands
# ==============================================================================

.PHONY: sync

DATA_MOUNT ?= -v ./data/gmail:/data

sync:
	$(COMPOSE) run --rm $(RUN_USER) $(DATA_MOUNT) gmail npx ts-node src/tools/gmail/gmail.ts
