# ==============================================================================
# 🗄️ Tests
# ==============================================================================

.PHONY: *

urls:
	$(COMPOSE) run --rm $(RUN_USER) worker npx ts-node tests/sites/linkedin/UrlManager.test.ts

mcp:
	$(COMPOSE) run --rm $(RUN_USER) viewer npx ts-node tests/sites/linkedin/McpClient.test.ts

recursive:
	$(COMPOSE) run --rm $(RUN_USER) -e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE) -e SITE=$(SITE) worker npx ts-node tests/recursive/RecursiveScrape.test.ts

sites:
	$(COMPOSE) run --rm $(RUN_USER) worker npx ts-node tests/sites/dailydoseofds/Converter.test.ts
	$(COMPOSE) run --rm $(RUN_USER) worker npx ts-node tests/sites/geeknews/Converter.test.ts
	$(COMPOSE) run --rm $(RUN_USER) worker npx ts-node tests/sites/maily/josh/Converter.test.ts
	$(COMPOSE) run --rm $(RUN_USER) worker npx ts-node tests/sites/pytorch_kr/Converter.test.ts
	$(COMPOSE) run --rm $(RUN_USER) worker npx ts-node tests/sites/yozm/Converter.test.ts

extract:
	@if [ -z "$(SITE)" ] || [ -z "$(ID)" ]; then \
		echo "❌ Error: SITE and ID variables must be specified. (e.g. make extract SITE=yozm ID=3800)"; \
		exit 1; \
	fi
	$(COMPOSE) run --rm $(RUN_USER) $(WORKSPACE_MOUNT) -v /app/node_modules worker npx ts-node src/scripts/extract_article.ts --site $(SITE) --id $(ID)

debug:
	@if [ -z "$(FILE)" ] && ([ -z "$(SITE)" ] || [ -z "$(ID)" ]); then \
		echo "❌ Error: Either FILE, or SITE and ID variables must be specified."; \
		echo "Usage 1: make debug FILE=tests/sites/yozm/fixtures/3800.html"; \
		echo "Usage 2: make debug SITE=yozm ID=3800"; \
		exit 1; \
	fi
	@if [ -n "$(FILE)" ]; then \
		$(COMPOSE) run --rm $(RUN_USER) $(WORKSPACE_MOUNT) -v /app/node_modules worker npx ts-node src/scripts/debug_html.ts --file $(FILE); \
	else \
		$(COMPOSE) run --rm $(RUN_USER) $(WORKSPACE_MOUNT) -v /app/node_modules worker npx ts-node src/scripts/debug_html.ts --site $(SITE) --id $(ID); \
	fi

