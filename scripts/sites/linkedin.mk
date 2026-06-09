# ==============================================================================
# 💼 LinkedIn Scraper Commands Module
# ==============================================================================

.PHONY: list company extract-urls refresh-urls refresh-silver status help

# 📝 환경변수 기본값 설정
GEOS       ?= South Korea,United Arab Emirates,Japan
AUTH       ?= true
SLACK_TIME ?= 3
CHUNK_SIZE ?= 500
PRIORITY   ?= medium

help:
	@echo "========================================================================="
	@echo "💼 LinkedIn Scraper Module Commands Help"
	@echo "========================================================================="
	@echo "사용 가능한 명령어 목록:"
	@echo "  make li-list        - LinkedIn 채용공고 목록 수집 (ListScraper)을 실행합니다."
	@echo "                        (예: make li-list AUTH=true SLACK_TIME=3)"
	@echo "  make li-company     - LinkedIn 회사 정보 수집 (Pipeline)을 실행합니다."
	@echo "                        (예: make li-company AUTH=true SLACK_TIME=3)"
	@echo "  make li-extract-urls - 기존 HTML 데이터로부터 미수집 Job URL들을 추출하여"
	@echo "                        Redis 수집 대기열 및 DB에 적재합니다. (Extract)"
	@echo "                        (예: make li-extract-urls CHUNK_SIZE=500 SLACK_TIME=3)"
	@echo "  make li-refresh-urls - 타겟 국가 설정에 맞춰 Redis 큐를 복구 및 수정합니다."
	@echo "                        (예: make li-refresh-urls GEOS=\"South Korea,Japan\")"
	@echo "  make li-refresh-md  - 실버 레이어 누락 데이터를 Redis 큐에 넣어 재가공(Backfill)합니다."
	@echo "                        (예: make li-refresh-md OVERWRITE=true)"
	@echo "  make li-status      - Bronze 레이어와 Silver 레이어 적재 통계 비교 보고서를 출력합니다."
	@echo "  make li-restart     - 크롤러 및 트랜스포머 워커 서비스를 재빌드 및 재시작합니다."
	@echo "========================================================================="

# 모든 실행 타겟들을 컨테이너 내부의 npx ts-node 명령으로 직접 맵핑하여 위임
list: PRIORITY := high
list:
	$(COMPOSE) run --rm $(RUN_USER) -e AUTH=$(AUTH) -e SLACK_TIME=$(SLACK_TIME) -e PRIORITY=$(PRIORITY) clipper npx ts-node src/sites/linkedin/jobs/ListScraper.ts

company: PRIORITY := high
company:
	$(COMPOSE) run --rm $(RUN_USER) -e AUTH=$(AUTH) -e SLACK_TIME=$(SLACK_TIME) -e PRIORITY=$(PRIORITY) clipper npx ts-node src/sites/linkedin/company/Pipeline.ts

extract-urls:
	$(COMPOSE) run --rm $(RUN_USER) -e SLACK_TIME=$(SLACK_TIME) -e CHUNK_SIZE=$(CHUNK_SIZE) clipper npx ts-node src/sites/linkedin/jobs/ExtractUrls.ts

refresh-urls:
	$(COMPOSE) run --rm $(RUN_USER) -e GEOS="$(GEOS)" clipper npx ts-node src/sites/linkedin/jobs/RefreshUrls.ts

refresh-silver:
	$(COMPOSE) run --rm $(RUN_USER) -e OVERWRITE=$(OVERWRITE) clipper npx ts-node src/sites/linkedin/jobs/TransformerRefresh.ts

status:
	$(COMPOSE) run --rm $(RUN_USER) clipper npx ts-node src/sites/linkedin/jobs/StatusReport.ts
