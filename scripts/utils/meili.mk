# ==============================================================================
# 🔍 Meilisearch Management Commands
# ==============================================================================

.PHONY: refresh-index reset-index status

refresh-index:
	@echo "🐳 Syncing MongoDB Silver documents to Meilisearch index (Upsert mode)..."
	$(COMPOSE) run --rm $(RUN_USER) $(WORKSPACE_MOUNT) -v /app/node_modules -T worker npx ts-node src/scripts/meili-manager.ts

reset-index:
	@echo "🐳 Clearing index and rebuilding all Meilisearch documents (Clean Rebuild mode)..."
	$(COMPOSE) run --rm $(RUN_USER) $(WORKSPACE_MOUNT) -v /app/node_modules -T worker npx ts-node src/scripts/meili-manager.ts --clean

status:
	@echo "🐳 Checking Meilisearch index statistics..."
	@$(COMPOSE) run --rm $(RUN_USER) $(WORKSPACE_MOUNT) -v /app/node_modules -T worker node -e "\
		fetch('http://meilisearch:7700/stats', { headers: { Authorization: 'Bearer superMasterKeySecret123' } })\
			.then(r => r.json())\
			.then(data => console.log(JSON.stringify(data, null, 2)))\
			.catch(err => console.error('Error fetching stats:', err.message))"
