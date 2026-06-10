# ==============================================================================
# 🗄️ Pipeline
# ==============================================================================

.PHONY: *

SCALE ?= 3

restart:
	SCALE=$(SCALE) $(COMPOSE) up -d --build clipper-scraper clipper-transformer viewer
