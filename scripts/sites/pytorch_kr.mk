# ==============================================================================
# 🔥 PyTorch KR Scraper Commands Module
# ==============================================================================

.PHONY: list contents refresh fix-queue

PAGE ?= 1

list:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/pytorch_kr/List.ts $(PAGE)

contents:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/pytorch_kr/Contents.ts $(PAGE)

refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/pytorch_kr/Refresh.ts

fix-queue:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/pytorch_kr/FixQueue.ts


