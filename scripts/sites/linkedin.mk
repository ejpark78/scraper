# ==============================================================================
# 💼 LinkedIn Scraper Commands Module
# ==============================================================================

.PHONY: list company backfill fix-queue restart-worker

# 📝 환경변수 기본값 설정
LISTS      ?= config/config.json
PARALLEL   ?= 1
AUTH       ?= true
SLACK_TIME ?= 3
CHUNK_SIZE ?= 500

# 모든 실행 타겟들을 컨테이너 내부의 npx ts-node 명령으로 직접 맵핑하여 위임
list:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/crawler.ts list $(LISTS)

company:
	$(COMPOSE) run --rm $(RUN_USER) -e AUTH=$(AUTH) -e PARALLEL=$(PARALLEL) -e SLACK_TIME=$(SLACK_TIME) clipper npx ts-node src/company/company_pipeline.ts

backfill:
	$(COMPOSE) run --rm $(RUN_USER) -e SLACK_TIME=$(SLACK_TIME) -e CHUNK_SIZE=$(CHUNK_SIZE) clipper npx ts-node src/jobs/backfill.ts

fix-queue:
	$(COMPOSE) run --rm $(RUN_USER) -e GEOS="$(GEOS)" clipper npx ts-node src/jobs/fix_queue.ts

restart-worker:
	@$(COMPOSE) up -d --build clipper-worker
