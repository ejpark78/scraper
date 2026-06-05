# ==============================================================================
# ⚙️ LinkedIn Scraper Makefile (Command Interface Router)
# ==============================================================================
# 
# [ 전체 데이터 수집 파이프라인 흐름 (Scraping Data Flow) ]
# 
#  1. 공고 목록 수집 (make list)
#     [LinkedIn Web] ──➜ Playwright (clipper) ──➜ MongoDB (bronze.lists)
# 
#  2. 공고 분석 & 회사 목록 추출 (make urls)
#     [MongoDB (bronze.lists)] ──➜ UrlManager (clipper)
#                                        │
#                                        ├─➜ (신규 공고 적재) ─➜ [MongoDB (bronze.job_urls) / Redis (jobs_queue)]
#                                        └─➜ (신규 회사 적재) ─➜ [MongoDB (bronze.company_urls)]
# 
#  3. 상세 정보 다운로드 및 변환
#     A. 채용 정보 수집 (make jobs / worker)
#        [Redis (jobs_queue)] ──➜ Work Loop (clipper-worker)
#                                      │
#                                      ├─➜ [MongoDB (bronze.jobs / silver.jobs)]
#                                      └─➜ [Markdown (.md)]
# 
#     B. 회사 정보 수집 (make company)
#        [MongoDB (bronze.company_urls)] ──➜ CompanyPipeline (clipper)
#                                               │
#                                               ├─➜ [MongoDB (bronze.companies / silver.companies)]
#                                               └─➜ [Markdown (.md)]
# 
# ==============================================================================

# 공통 프로젝트 지정을 위한 단일 Docker Compose 명령어 (루트 compose.yml include 사용)
COMPOSE := HOST_PROJECT_PATH=$$(pwd) docker compose


.PHONY: *

# 📝 환경변수 기본값 설정 (중복 조건문 제거 및 단일 조건부 할당으로 최적화)
LISTS      ?= config/config.json
PARALLEL   ?= 1
AUTH       ?= true
SLACK_TIME ?= 3
CHUNK_SIZE ?= 500


# 컨테이너 실행 판별 플래그 (호스트 vs 컨테이너)
IN_CONTAINER ?= false

# 기본 도움말
help:
	@echo "========================================================================="
	@echo "🌐 LinkedIn Job Scraper CLI (Dockerized - Include Modular)"
	@echo "========================================================================="
	@echo "사용 가능한 명령어 목록 (자동 Docker 가동):"
	@echo "  make build          - [Host] Docker 컨테이너 이미지를 빌드합니다."
	@echo "  make up             - 인프라 및 모든 개발 도구(Traefik, Yacht, Jupyter 등)를 기동합니다."
	@echo "  make down           - 작동 중인 모든 모듈과 인프라를 일괄 종료합니다."
	@echo "  make login          - [Host/Kasm] 1회성 브라우저를 띄워 로그인 세션(session.json)을 로컬에 덤프합니다."
	@echo "  make kasm           - [Host] Kasm 컨테이너 내부 쉘(shell)에 진입합니다."
	@echo "  make open           - [Host/Kasm] 로그인 세션 기반 헤드풀 브라우저 기동"
	@echo "  make list           - [Docker] config.json 조건 기반으로 목록 HTML을 무인 수집합니다."
	@echo "                        * 옵션: LISTS (설정경로), PARALLEL (병렬수), AUTH (인증여부), SLACK_TIME (지연초)"
	@echo "                        * 예시 (기본 설정 실행): make list"
	@echo "                        * 예시 (옵션 종합 지정): make list LISTS=config/custom.json PARALLEL=1 AUTH=true SLACK_TIME=5"
	@echo "  make company        - [Docker] MongoDB(bronze.company_urls) 기반 회사 정보를 수집하여 마크다운으로 저장합니다."
	@echo "                        * 옵션: AUTH (인증여부), PARALLEL (병렬수), SLACK_TIME (지연초)"
	@echo "                        * 예시 (기본 회사 수집): make company"
	@echo "                        * 예시 (옵션 종합 지정): make company AUTH=true PARALLEL=1 SLACK_TIME=5"
	@echo "  make test           - [Docker] URL 생성기 단위 테스트 실행"
	@echo "  make backfill       - [Docker] DB에 이미 저장된 상세 HTML의 추천공고 중 미수집 건 역추적하여 적재"
	@echo "                        * 옵션: SLACK_TIME (지연초), CHUNK_SIZE (배치크기)"
	@echo "                        * 예시 (기본 역추적 실행): make backfill"
	@echo "                        * 예시 (옵션 종합 지정): make backfill SLACK_TIME=5 CHUNK_SIZE=200"
	@echo "  make check-worker   - [Host/Kasm] Redis의 다운로드 큐 상태와 워커 컨테이너 상태를 확인합니다."
	@echo "  make fix-queue      - [Host/Kasm] 미수집된 유실/잔여 타겟의 DB 상태를 복구하여 Redis 대기 상태로 전환합니다."
	@echo "                        * 옵션: GEOS (복구 국가 목록)"
	@echo "                        * 예시 (기본 국가 복구): make fix-queue"
	@echo "                        * 예시 (특정 국가 지정): make fix-queue GEOS=\"'South Korea'\""
	@echo "                        * 예시 (여러 국가 지정): make fix-queue GEOS=\"'South Korea','Japan'\""
	@echo "  make lint-yaml      - [Docker] 프로젝트 내 모든 compose.yml 및 yml 파일의 문법 린트를 검사합니다."
	@echo "  make clean          - [Host/Kasm] 임시 파일 및 빈 폴더 정리"
	@echo "  make dump-silver    - [Host/Kasm] 정제된 실버 레이어(silver.*) 데이터만 백업합니다."
	@echo "  make dump-bronze    - [Host/Kasm] 수집 원본 브론즈 레이어(bronze.*) 데이터만 백업합니다."
	@echo "========================================================================="
	@echo "⚙️ 설정 가능한 환경 변수 및 기본값 (변수=값 형태로 오버라이드 가능):"
	@echo "  LISTS      - 수집 대상 설정 JSON 파일 경로 (기본값: config/config.json)"
	@echo "  PARALLEL   - 동시 구동할 브라우저 러너 수량   (기본값: 1)"
	@echo "  AUTH       - 브라우저 로그인 세션 사용 여부    (기본값: true)"
	@echo "  SLACK_TIME - 페이지 요청 간의 대기 지연 초    (기본값: 3)"
	@echo "  CHUNK_SIZE - 일괄 처리 배치 조각 단위 수량     (기본값: 500)"
	@echo "========================================================================="

# Docker 이미지 빌드
build:
	$(COMPOSE) --profile tools --profile runtime build

# 전체 모듈 일괄 기동
up:
	$(COMPOSE) up -d
	@echo "🚀 모든 서비스와 어드민 도구가 성공적으로 실행되었습니다."

# 전체 모듈 일괄 종료
down:
	$(COMPOSE) --profile tools down || true
	@echo "🛑 모든 서비스가 종료되었습니다."

# MongoDB 백업 - Silver Layer (silver.jobs, silver.companies)
dump-silver:
	@mkdir -p data
	$(COMPOSE) exec -T mongodb mongodump --db linkedin --collection silver.jobs --gzip --archive=/tmp/silver_jobs.gz
	docker cp $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/silver_jobs.gz data/silver_jobs.gz
	$(COMPOSE) exec -T mongodb mongodump --db linkedin --collection silver.companies --gzip --archive=/tmp/silver_companies.gz
	docker cp $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/silver_companies.gz data/silver_companies.gz
	@echo "💾 Silver 레이어 백업 완료: data/silver_jobs.gz, data/silver_companies.gz"

# MongoDB 백업 - Bronze Layer (Raw 데이터 - 용량 큼)
dump-bronze:
	@mkdir -p data
	$(COMPOSE) exec -T mongodb mongodump --db linkedin --collection bronze.jobs --gzip --archive=/tmp/bronze_jobs.gz
	docker cp $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/bronze_jobs.gz data/bronze_jobs.gz
	$(COMPOSE) exec -T mongodb mongodump --db linkedin --collection bronze.companies --gzip --archive=/tmp/bronze_companies.gz
	docker cp $$(docker compose -p linkedin -f compose.yml ps -q mongodb):/tmp/bronze_companies.gz data/bronze_companies.gz
	@echo "💾 Bronze 레이어 백업 완료: data/bronze_jobs.gz, data/bronze_companies.gz"

# 호스트(Host) 구동 필수 타겟
login:
	npx ts-node src/crawler.ts login

open:
	npx ts-node src/browser/open.ts

kasm:
	$(COMPOSE) exec -it kasm /bin/zsh

logout:
	rm -f config/session.json
	@echo "🔒 로그인 세션이 성공적으로 삭제되었습니다."




# 호스트 가동 시 컨테이너로 위임(Proxy), 컨테이너 내부일 경우 실제 작업 수행
ifeq ($(IN_CONTAINER),true)

job-list:
	@if [ ! -f "$(LISTS)" ]; then \
		echo "❌ 에러: 수집 대상 설정 파일이 존재하지 않습니다: $(LISTS)"; \
		exit 1; \
	fi
	LOGIN=$(AUTH) PARALLEL=$(PARALLEL) SLACK_TIME=$(SLACK_TIME) npx ts-node src/crawler.ts list $(LISTS)

list: job-list

company:
	LOGIN=$(AUTH) PARALLEL=$(PARALLEL) SLACK_TIME=$(SLACK_TIME) npx ts-node src/company/company_pipeline.ts

test:
	npx ts-node tests/url_manager.test.ts

backfill:
	SLACK_TIME=$(SLACK_TIME) CHUNK_SIZE=$(CHUNK_SIZE) npx ts-node src/jobs/backfill.ts

fix-queue:
	GEOS="$(GEOS)" npx ts-node src/jobs/fix_queue.ts

lint-yaml:
	npx yaml-lint compose.yml "docker/**/*.yml"

else

# 호스트 환경에서 컨테이너 구동으로 위임하는 인터페이스 프록시
list:
	$(COMPOSE) run --rm --user $$(id -u):$$(id -g) -e HOST_PROJECT_PATH=$$(pwd) -e IN_CONTAINER=true clipper make list LISTS=$(LISTS) AUTH=$(AUTH) PARALLEL=$(PARALLEL) SLACK_TIME=$(SLACK_TIME)

job-list: list

company:
	$(COMPOSE) run --rm --user $$(id -u):$$(id -g) -e HOST_PROJECT_PATH=$$(pwd) -e IN_CONTAINER=true -e AUTH=$(AUTH) -e PARALLEL=$(PARALLEL) -e SLACK_TIME=$(SLACK_TIME) clipper make company AUTH=$(AUTH) PARALLEL=$(PARALLEL) SLACK_TIME=$(SLACK_TIME)

test:
	$(COMPOSE) run --rm --user $$(id -u):$$(id -g) -e HOST_PROJECT_PATH=$$(pwd) -e IN_CONTAINER=true clipper make test

backfill:
	$(COMPOSE) run --rm --user $$(id -u):$$(id -g) -e HOST_PROJECT_PATH=$$(pwd) -e IN_CONTAINER=true -e SLACK_TIME=$(SLACK_TIME) -e CHUNK_SIZE=$(CHUNK_SIZE) clipper make backfill SLACK_TIME=$(SLACK_TIME) CHUNK_SIZE=$(CHUNK_SIZE)

fix-queue:
	$(COMPOSE) run --rm --user $$(id -u):$$(id -g) -e HOST_PROJECT_PATH=$$(pwd) -e IN_CONTAINER=true -e GEOS="$(GEOS)" clipper make fix-queue GEOS="$(GEOS)"

lint-yaml:
	$(COMPOSE) run --rm --user $$(id -u):$$(id -g) -e HOST_PROJECT_PATH=$$(pwd) -e IN_CONTAINER=true clipper make lint-yaml

endif

# 데이터 청소 명령 (호스트에서 직접 파일 제어)
clean: clean-lists clean-recent
	rm -f data/jobs/temp_job_raw.md data/jobs/temp_job_raw_*.md
	find data/jobs -mindepth 1 -type d -empty -delete 2>/dev/null || true
	@echo "🧹 임시 파일, 빈 디렉토리 정리가 완료되었습니다."

clean-recent:
	rm -rf data/jobs/recent/html data/jobs/recent/markdown
	@echo "🧹 data/jobs/recent/ HTML/Markdown 파일이 모두 삭제되었습니다."

clean-lists:
	rm -rf data/jobs/lists/html/*
	@echo "🧹 data/jobs/lists/html/ HTML 파일 및 폴더가 모두 삭제되었습니다."

purge:
	@echo "⚠️  [경고] 수집된 모든 HTML 파일과 마크다운 포스트를 완전히 삭제합니다."
	@read -p "정말 진행하시겠습니까? [y/N]: " confirm && [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ] || (echo "❌ 중단되었습니다."; exit 1)
	rm -rf data/jobs
	@echo "✨ data/jobs 디렉토리가 완전히 초기화되었습니다."

check-worker:
	@echo "🔍 Checking Redis queue status..."
	@docker exec linkedin-redis-1 redis-cli LLEN jobs_queue 2>/dev/null | awk '{print "📥 jobs_queue (download queue) length: " $$1}' || echo "❌ jobs_queue: Unable to connect to Redis"
	@docker exec linkedin-redis-1 redis-cli SCARD completed_jobs 2>/dev/null | awk '{print "✅ completed_jobs (completed list) count: " $$1}' || echo "❌ completed_jobs: Unable to connect to Redis"
	@echo ""
	@echo "📋 Active worker containers:"
	@docker ps --filter "name=linkedin-clipper-worker" --format "table {{.Names}}\t{{.Status}}"


