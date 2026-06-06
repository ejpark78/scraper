# ==============================================================================
# 💼 LinkedIn Scraper Commands Module
# ==============================================================================

.PHONY: list backfill fix-queue restart

# 📝 환경변수 기본값 설정
GEOS       ?= South Korea,United Arab Emirates,Japan
AUTH       ?= true
SLACK_TIME ?= 3
CHUNK_SIZE ?= 500

# 모든 실행 타겟들을 컨테이너 내부의 npx ts-node 명령으로 직접 맵핑하여 위임
list:
	$(COMPOSE) run --rm $(RUN_USER) -e AUTH=$(AUTH) -e SLACK_TIME=$(SLACK_TIME) clipper npx ts-node src/sites/linkedin/jobs/ListScraper.ts

backfill:
	$(COMPOSE) run --rm $(RUN_USER) -e SLACK_TIME=$(SLACK_TIME) -e CHUNK_SIZE=$(CHUNK_SIZE) clipper npx ts-node src/sites/linkedin/jobs/Backfill.ts

fix-queue:
	$(COMPOSE) run --rm $(RUN_USER) -e GEOS="$(GEOS)" clipper npx ts-node src/sites/linkedin/jobs/FixQueue.ts

restart:
	@$(COMPOSE) up -d --build clipper-scraper
	@$(COMPOSE) up -d --build clipper-transformer
