# ==============================================================================
# 🗄️ MongoDB Backup & Restore Commands
# ==============================================================================

.PHONY: dump dump-silver dump-bronze

dump: dump-bronze dump-silver

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
