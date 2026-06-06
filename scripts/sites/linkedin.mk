# ==============================================================================
# 💼 LinkedIn Scraper Commands Module
# ==============================================================================

.PHONY: list company backfill fix-queue restart help

# 📝 환경변수 기본값 설정
GEOS       ?= South Korea,United Arab Emirates,Japan
AUTH       ?= true
SLACK_TIME ?= 3
CHUNK_SIZE ?= 500

help:
	@echo "========================================================================="
	@echo "💼 LinkedIn Scraper Module Commands Help"
	@echo "========================================================================="
	@echo "사용 가능한 명령어 목록:"
	@echo "  make li-list        - LinkedIn 채용공고 목록 수집 (ListScraper)을 실행합니다."
	@echo "                        (예: make li-list AUTH=true SLACK_TIME=3)"
	@echo "  make li-company     - LinkedIn 회사 정보 수집 (Pipeline)을 실행합니다."
	@echo "                        (예: make li-company AUTH=true SLACK_TIME=3)"
	@echo "  make li-backfill    - 기존 HTML 데이터로부터 미수집 Job URL들을 추출하여"
	@echo "                        Redis 수집 대기열 및 DB에 적재합니다. (Backfill)"
	@echo "                        (예: make li-backfill CHUNK_SIZE=500 SLACK_TIME=3)"
	@echo "  make li-fix-queue   - 타겟 국가 설정에 맞춰 Redis 큐를 복구 및 수정합니다."
	@echo "                        (예: make li-fix-queue GEOS=\"South Korea,Japan\")"
	@echo "  make li-restart     - 크롤러 및 트랜스포머 워커 서비스를 재빌드 및 재시작합니다."
	@echo "========================================================================="

# 모든 실행 타겟들을 컨테이너 내부의 npx ts-node 명령으로 직접 맵핑하여 위임
list:
	$(COMPOSE) run --rm $(RUN_USER) -e AUTH=$(AUTH) -e SLACK_TIME=$(SLACK_TIME) clipper npx ts-node src/sites/linkedin/jobs/ListScraper.ts

company:
	$(COMPOSE) run --rm $(RUN_USER) -e AUTH=$(AUTH) -e SLACK_TIME=$(SLACK_TIME) clipper npx ts-node src/sites/linkedin/company/Pipeline.ts

backfill:
	$(COMPOSE) run --rm $(RUN_USER) -e SLACK_TIME=$(SLACK_TIME) -e CHUNK_SIZE=$(CHUNK_SIZE) clipper npx ts-node src/sites/linkedin/jobs/Backfill.ts

fix-queue:
	$(COMPOSE) run --rm $(RUN_USER) -e GEOS="$(GEOS)" clipper npx ts-node src/sites/linkedin/jobs/FixQueue.ts

restart:
	@$(COMPOSE) up -d --build clipper-scraper
	@$(COMPOSE) up -d --build clipper-transformer
