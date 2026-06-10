# ==============================================================================
# 📰 Maily Josh Scraper Commands Module
# ==============================================================================

include ../environments.mk

.PHONY: list refresh-urls refresh-silver refresh-silver-rebuild help

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
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) -e LIST_SLACK=$(LIST_SLACK) clipper npx ts-node src/crawler/sites/maily_josh/List.ts

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-urls.ts maily_josh

refresh-silver:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-transform.ts maily_josh

refresh-silver-rebuild:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts maily_josh
