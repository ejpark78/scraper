# ==============================================================================
# 🔥 PyTorch KR Scraper Commands Module
# ==============================================================================

.PHONY: list contents refresh refresh-urls

PAGE ?= 1

list:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/pytorch_kr/List.ts $(PAGE)

contents:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/pytorch_kr/Contents.ts $(PAGE)

refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/pytorch_kr/Refresh.ts

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/pytorch_kr/RefreshUrls.ts


