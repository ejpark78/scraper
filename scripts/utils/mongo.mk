# ==============================================================================
# 🗄️ MongoDB Backup & Restore Commands
# ==============================================================================

.PHONY: dump restore index

DB ?= bronze,silver,crawler
DUMP_DIR ?= data/backup/mongodb/$(shell date +%Y%m%dT%H%M%S)

dump:
	@if [ -z "$(DB)" ]; then \
		echo "❌ 에러: DB 변수를 지정해야 합니다. (예: make dump-db DB=bronze,silver)"; \
		exit 1; \
	fi
	@mkdir -p $(DUMP_DIR)
	$(COMPOSE) exec -T mongodb sh -c "rm -rf /tmp/mongodb_backup && mkdir -p /tmp/mongodb_backup"
	for db in $$(echo "$(DB)" | tr ',' ' '); do \
		$(COMPOSE) exec -T mongodb mongodump --db=$$db --gzip --out=/tmp/mongodb_backup; \
	done
	$(COMPOSE) cp mongodb:/tmp/mongodb_backup/. $(DUMP_DIR)
	$(COMPOSE) exec -T mongodb rm -rf /tmp/mongodb_backup
	@echo "💾 DB( $(DB) ) Gzip 압축 백업 완료 -> $(DUMP_DIR)"

restore:
	@if [ -z "$(BACKUP_DIR)" ]; then \
		echo "❌ 에러: BACKUP_DIR 변수를 지정해야 합니다. (예: make restore-db BACKUP_DIR=backup/mongodb/20260606_214122)"; \
		exit 1; \
	fi
	$(COMPOSE) exec -T mongodb sh -c "rm -rf /tmp/mongodb_restore"
	$(COMPOSE) cp data/$(BACKUP_DIR) mongodb:/tmp/mongodb_restore
	$(COMPOSE) exec -T mongodb mongorestore --gzip /tmp/mongodb_restore
	$(COMPOSE) exec -T mongodb rm -rf /tmp/mongodb_restore
	@echo "💾 DB 복구 완료."

index:
	@echo "🐳 Running index synchronization via volume-mounted temporary container..."
	$(COMPOSE) run --rm -T worker npx ts-node src/scripts/sync-indexes.ts

show-columns:
	@echo "🔍 Mapping MongoDB Collection Columns..."
	$(COMPOSE) run --rm $(RUN_USER) -v /app/node_modules worker npx ts-node src/scripts/show_collection_columns.ts

