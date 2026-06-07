# ==============================================================================
# 🗄️ Pipeline
# ==============================================================================

.PHONY: *

restart:
	@$(COMPOSE) up -d --build clipper-scraper
	@$(COMPOSE) up -d --build clipper-transformer
