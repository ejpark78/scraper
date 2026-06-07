# ==============================================================================
# 🗄️ Pipeline
# ==============================================================================

.PHONY: *

SCALE ?= 3

restart:
	@$(COMPOSE) up -d --build --scale clipper-scraper=$(SCALE) clipper-scraper
	@$(COMPOSE) up -d --build clipper-transformer

