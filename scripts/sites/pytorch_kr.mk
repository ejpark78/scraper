# ==============================================================================
# 🔥 PyTorch KR Scraper Commands Module
# ==============================================================================

.PHONY: dispatch pipeline

PAGE ?= 1

dispatch:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/pytorch_kr/PyTorchKRDispatcher.ts $(PAGE)

pipeline:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/pytorch_kr/PyTorchKRPipeline.ts $(PAGE)
