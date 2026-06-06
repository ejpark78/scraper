# ==============================================================================
# 🗄️ MongoDB Backup & Restore Commands
# ==============================================================================

.PHONY: dump dump-silver dump-bronze dump-active-db restore-active-db

dump: dump-bronze dump-silver

dump-active-db:
	@mkdir -p data
	$(COMPOSE) exec -T mongodb sh -c "rm -rf /tmp/mongodb_backup && mkdir -p /tmp/mongodb_backup"
	$(COMPOSE) exec -T mongodb mongodump --db=bronze --gzip --out=/tmp/mongodb_backup
	$(COMPOSE) exec -T mongodb mongodump --db=crawler --gzip --out=/tmp/mongodb_backup
	$(COMPOSE) exec -T mongodb mongodump --db=silver --gzip --out=/tmp/mongodb_backup
	docker cp $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/mongodb_backup data/mongodb_backup_$$(date +%Y%m%d_%H%M%S)
	$(COMPOSE) exec -T mongodb rm -rf /tmp/mongodb_backup
	@echo "💾 Active DB (bronze, crawler, silver) Gzip 압축 및 컬렉션별 분리 백업 완료."

restore-active-db:
	@if [ -z "$(BACKUP_DIR)" ]; then \
		echo "❌ 에러: BACKUP_DIR 변수를 지정해야 합니다. (예: make restore-active-db BACKUP_DIR=mongodb_backup_20260606_214122)"; \
		exit 1; \
	fi
	$(COMPOSE) exec -T mongodb sh -c "rm -rf /tmp/mongodb_restore"
	docker cp data/$(BACKUP_DIR) $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/mongodb_restore
	$(COMPOSE) exec -T mongodb mongorestore --gzip /tmp/mongodb_restore
	$(COMPOSE) exec -T mongodb rm -rf /tmp/mongodb_restore
	@echo "💾 Active DB (bronze, crawler, silver) 복구 완료."

dump-silver:
	@mkdir -p data
	$(COMPOSE) exec -T mongodb mongodump --db linkedin --collection silver.jobs --gzip --archive=/tmp/silver_jobs.gz
	docker cp $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/silver_jobs.gz data/silver_jobs.gz
	$(COMPOSE) exec -T mongodb mongodump --db linkedin --collection silver.companies --gzip --archive=/tmp/silver_companies.gz
	docker cp $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/silver_companies.gz data/silver_companies.gz
	@echo "💾 Silver 레이어 백업 완료: data/silver_jobs.gz, data/silver_companies.gz"

dump-bronze:
	@mkdir -p data
	$(COMPOSE) exec -T mongodb mongodump --db linkedin --collection bronze.jobs --gzip --archive=/tmp/bronze_jobs.gz
	docker cp $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/bronze_jobs.gz data/bronze_jobs.gz
	$(COMPOSE) exec -T mongodb mongodump --db linkedin --collection bronze.companies --gzip --archive=/tmp/bronze_companies.gz
	docker cp $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/bronze_companies.gz data/bronze_companies.gz
	@echo "💾 Bronze 레이어 백업 완료: data/bronze_jobs.gz, data/bronze_companies.gz"
