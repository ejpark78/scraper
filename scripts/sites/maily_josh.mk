# ==============================================================================
# 📰 Maily Josh Scraper Commands Module
# ==============================================================================

.PHONY: list refresh-urls refresh-silver help

PAGE       ?= 1
SLACK_TIME ?= 2
PRIORITY   ?= medium
OVERWRITE  ?= false
ERROR_RESET ?= false
RECURSIVE_SCRAPE ?= false

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
	$(COMPOSE) run --rm $(RUN_USER) -e PAGE=$(PAGE) -e SLACK_TIME=$(SLACK_TIME) -e PRIORITY=$(PRIORITY) -e OVERWRITE=$(OVERWRITE) -e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE) clipper npx ts-node src/crawler/sites/maily_josh/List.ts

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) -e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE) -e ERROR_RESET=$(ERROR_RESET) clipper npx ts-node src/crawler/sites/maily_josh/RefreshUrls.ts

refresh-silver:
	$(COMPOSE) run --rm $(RUN_USER) -e OVERWRITE=$(OVERWRITE) clipper npx ts-node src/crawler/sites/maily_josh/QueueTransform.ts
