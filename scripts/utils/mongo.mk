# ==============================================================================
# 🗄️ MongoDB Backup & Restore Commands
# ==============================================================================

.PHONY: dump dump-db restore-db show-job

DB ?= bronze,silver
DUMP_DIR ?= data/mongodb_backup_$(shell date +%Y%m%d_%H%M%S)

dump:
	@if [ -z "$(DB)" ]; then \
		echo "❌ 에러: DB 변수를 지정해야 합니다. (예: make dump-db DB=bronze,silver)"; \
		exit 1; \
	fi
	@mkdir -p data
	$(COMPOSE) exec -T mongodb sh -c "rm -rf /tmp/mongodb_backup && mkdir -p /tmp/mongodb_backup"
	for db in $$(echo "$(DB)" | tr ',' ' '); do \
		$(COMPOSE) exec -T mongodb mongodump --db=$$db --gzip --out=/tmp/mongodb_backup; \
	done
	docker cp $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/mongodb_backup $(DUMP_DIR)
	$(COMPOSE) exec -T mongodb rm -rf /tmp/mongodb_backup
	@echo "💾 DB( $(DB) ) Gzip 압축 백업 완료 -> $(DUMP_DIR)"

restore:
	@if [ -z "$(BACKUP_DIR)" ]; then \
		echo "❌ 에러: BACKUP_DIR 변수를 지정해야 합니다. (예: make restore-db BACKUP_DIR=mongodb_backup_20260606_214122)"; \
		exit 1; \
	fi
	$(COMPOSE) exec -T mongodb sh -c "rm -rf /tmp/mongodb_restore"
	docker cp data/$(BACKUP_DIR) $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/mongodb_restore
	$(COMPOSE) exec -T mongodb mongorestore --gzip /tmp/mongodb_restore
	$(COMPOSE) exec -T mongodb rm -rf /tmp/mongodb_restore
	@echo "💾 DB 복구 완료."
