# ==============================================================================
# 📚 Daily Dose of Data Science Scraper Commands Module
# ==============================================================================

.PHONY: list refresh-urls refresh-silver help

PAGE       ?= 1

help:
	@echo "========================================================================="
	@echo "📚 Daily Dose of DS Scraper Module Commands Help"
	@echo "========================================================================="
	@echo "사용 가능한 명령어 목록:"
	@echo "  make ddds-list        - Daily Dose of DS 게시글 목록 수집을 실행합니다."
	@echo "                        (예: make ddds-list PAGE=5 LIST_SLACK=3 RECURSIVE_SCRAPE=true)"
	@echo "  make ddds-refresh-urls - 타겟 설정에 맞춰 Redis 큐를 복구 및 수정합니다."
	@echo "  make ddds-refresh-silver - 실버 레이어 누락 데이터를 Redis 큐에 넣어 재가공합니다."
	@echo "========================================================================="

list: PRIORITY := high
list:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [DailyDoseOfDS] Starting list scraping (PAGE: $(PAGE))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) base npx ts-node src/crawler/sites/dailydoseofds/List.ts

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [DailyDoseOfDS] Refreshing target queue URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) base npx ts-node src/crawler/core/cli-refresh-urls.ts dailydose_ds

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [DailyDoseOfDS] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) base npx ts-node src/crawler/core/cli-refresh-silver.ts dailydose_ds


