# ==============================================================================
# 🔥 PyTorch KR Scraper Commands Module
# ==============================================================================

include ../environments.mk

.PHONY: list refresh refresh-urls refresh-silver refresh-silver-rebuild

PAGE ?= 1-10

list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) -e PAGE=$(PAGE) clipper npx ts-node src/crawler/sites/pytorch_kr/List.ts $(PAGE)

refresh:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts pytorch_kr

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-urls.ts pytorch_kr

refresh-silver:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-transform.ts pytorch_kr

refresh-silver-rebuild:
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/core/cli-refresh-silver.ts pytorch_kr
