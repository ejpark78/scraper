# ==============================================================================
# 📰 Maily Josh Scraper Commands Module
# ==============================================================================

.PHONY: list refresh-urls refresh-silver help

PAGE       ?= 1
LIST_SLACK ?= 2

help:
	@echo "========================================================================="
	@echo "📰 Maily Josh (조쉬의 뉴스레터) Scraper Module Commands Help"
	@echo "========================================================================="
	@echo "사용 가능한 명령어 목록:"
	@echo "  make mj-list         - RSS 피드에서 게시글 URL 수집"
	@echo "  make mj-refresh-urls - Redis 큐를 복구 및 수정"
	@echo "  make mj-refresh-silver - 실버 레이어 누락 데이터를 재가공"
	@echo "========================================================================="

list: PRIORITY := high
list:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [Maily Josh] Starting list scraping (PAGE: $(PAGE))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) -e LIST_SLACK=$(LIST_SLACK) base npx ts-node src/crawler/sites/maily/josh/List.ts

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [Maily Josh] Refreshing target queue URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) base npx ts-node src/crawler/core/cli-refresh-urls.ts maily_josh

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [Maily Josh] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) base npx ts-node src/crawler/core/cli-refresh-silver.ts maily_josh


