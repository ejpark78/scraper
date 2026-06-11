# ==============================================================================
# 💼 LinkedIn Scraper Commands Module
# ==============================================================================

.PHONY: list company extract-urls refresh-urls refresh-silver status help

# 📝 환경변수 기본값 설정
GEOS       ?= South Korea,United Arab Emirates,Japan

help:
	@echo "========================================================================="
	@echo "💼 LinkedIn Scraper Module Commands Help"
	@echo "========================================================================="
	@echo "사용 가능한 명령어 목록:"
	@echo "  make li-list        - LinkedIn 채용공고 목록 수집 (List)을 실행합니다."
	@echo "                        (예: make li-list AUTH=true LIST_SLACK=3)"
	@echo "  make li-company     - LinkedIn 회사 정보 수집 (Pipeline)을 실행합니다."
	@echo "                        (예: make li-company AUTH=true LIST_SLACK=3)"
	@echo "  make li-extract-urls - 기존 HTML 데이터로부터 미수집 Job URL들을 추출하여"
	@echo "                        Redis 수집 대기열 및 DB에 적재합니다. (Extract)"
	@echo "                        (예: make li-extract-urls CHUNK_SIZE=500 LIST_SLACK=3)"
	@echo "  make li-refresh-urls - 타겟 국가 설정에 맞춰 Redis 큐를 복구 및 수정합니다."
	@echo "                        (예: make li-refresh-urls GEOS=\"South Korea,Japan\")"
	@echo "  make li-refresh-md  - 실버 레이어 누락 데이터를 Redis 큐에 넣어 재가공(Backfill)합니다."
	@echo "                        (예: make li-refresh-md OVERWRITE=true)"
	@echo "  make li-restart     - 크롤러 및 트랜스포머 워커 서비스를 재빌드 및 재시작합니다."
	@echo "========================================================================="

# 모든 실행 타겟들을 컨테이너 내부의 npx ts-node 명령으로 직접 맵핑하여 위임
list: PRIORITY := high
list:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [LinkedIn Jobs] Starting job list scraping..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/sites/linkedin/jobs/List.ts

company: PRIORITY := high
company:
	@echo "──────────────────────────────────────────────────"
	@echo "📡 [LinkedIn Company] Starting company scraping..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/sites/linkedin/company/Contents.ts

extract-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔍 [LinkedIn Jobs] Extracting un-scraped Job URLs..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/sites/linkedin/jobs/ExtractUrls.ts

refresh-urls:
	@echo "──────────────────────────────────────────────────"
	@echo "🔄 [LinkedIn Jobs] Refreshing target queue URLs (GEOS: $(GEOS))..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) -e GEOS="$(GEOS)" $(ENV_COMMON) clipper npx ts-node src/crawler/sites/linkedin/jobs/RefreshUrls.ts

refresh-silver:
	@echo "──────────────────────────────────────────────────"
	@echo "✨ [LinkedIn Jobs] Processing Silver Layer missing items..."
	@echo "──────────────────────────────────────────────────"
	$(COMPOSE) run --rm $(RUN_USER) $(ENV_COMMON) clipper npx ts-node src/crawler/sites/linkedin/jobs/RefreshTransform.ts

