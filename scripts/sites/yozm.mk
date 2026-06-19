# ==============================================================================
# 📰 요즘IT (Yozm) Scraper Commands Module
# ==============================================================================

.PHONY: list refresh-urls refresh-silver help

PAGE       ?= 1
LIST_SLACK ?= 2

help:
	@echo "========================================================================="
	@echo "📰 요즘IT (Yozm) Scraper Module Commands Help"
	@echo "========================================================================="
	@echo "사용 가능한 명령어 목록:"
	@echo "  make yz-list         - 작가 페이지에서 게시글 URL 수집"
	@echo "  make yz-refresh-urls - Redis 큐를 복구 및 수정"
	@echo "  make yz-refresh-silver - 실버 레이어 누락 데이터를 재가공"
	@echo "========================================================================="

list: PRIORITY := high
list:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [Yozm] Starting list scraping (PAGE: $(PAGE))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) -e LIST_SLACK=$(LIST_SLACK) worker npx ts-node src/cli-list.ts --site yozm --page "$(PAGE)"

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [YOZM] Refreshing target queue URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/cli-refresh-urls.ts --site yozm

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [YOZM] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) worker npx ts-node src/cli-refresh-silver.ts --site yozm
