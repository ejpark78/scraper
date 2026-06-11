# ==============================================================================
# 🗄️ Tests
# ==============================================================================

.PHONY: *

urls:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node tests/sites/linkedin/UrlManager.test.ts

mcp:
	$(COMPOSE) run --rm $(RUN_USER) viewer npx ts-node tests/sites/linkedin/McpClient.test.ts

recursive:
	$(COMPOSE) run --rm $(RUN_USER) -e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE) -e SITE=$(SITE) clipper npx ts-node tests/recursive/RecursiveScrape.test.ts

sites:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node tests/sites/dailydoseofds/Converter.test.ts
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node tests/sites/geeknews/Converter.test.ts
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node tests/sites/maily/josh/Converter.test.ts
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node tests/sites/pytorch_kr/Converter.test.ts
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node tests/sites/yozm/Converter.test.ts
