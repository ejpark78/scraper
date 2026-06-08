# ==============================================================================
# 🗄️ Tests
# ==============================================================================

.PHONY: *

urls:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node tests/url_manager.test.ts

mcp:
	$(COMPOSE) run --rm $(RUN_USER) viewer npx ts-node tests/mcp_client.ts
