# ⚙️ LinkedIn Job Scraper Makefile

.PHONY: help posts urls html2md clean purge login list job-list test migrate open logout build kasm init-cron export-cron check-worker

# URLS 변수 기본값 설정
URLS ?= data/jobs/lists/urls.json
ifeq ($(URLS),)
  URLS := data/jobs/lists/urls.json
endif

# LISTS 변수 기본값 설정
LISTS ?= config/config.json
ifeq ($(LISTS),)
  LISTS := config/config.json
endif

# 동시 실행 브라우저 갯수 기본값
PARALLEL ?= 1
ifeq ($(PARALLEL),)
  PARALLEL := 1
endif

# AUTH 기본값
AUTH ?= true
ifeq ($(AUTH),)
  AUTH := true
endif

# SLEEP_TIME 기본값
SLEEP_TIME ?= 3
ifeq ($(SLEEP_TIME),)
  SLEEP_TIME := 3
endif

# 컨테이너 실행 판별 플래그 (호스트 vs 컨테이너)
IN_CONTAINER ?= false

# 기본 도움말
help:
	@echo "========================================================================="
	@echo "🌐 LinkedIn Job Scraper CLI (Dockerized)"
	@echo "========================================================================="
	@echo "사용 가능한 명령어 목록 (자동 Docker 가동):"
	@echo "  make build          - Docker 컨테이너 이미지를 빌드합니다."
	@echo "  make login          - [Host] 1회성 브라우저를 띄워 로그인 세션(session.json)을 로컬에 덤프합니다."
	@echo "  make kasm           - [Host] Kasm 컨테이너 내부 쉘(shell)에 진입합니다."
	@echo "  make open           - [Host] 로그인 세션 기반 헤드풀 브라우저 기동"
	@echo "  make list           - [Docker] config.json 조건 기반으로 목록 HTML을 무인 수집합니다."
	@echo "  make company        - [Docker] urls.txt 기반 회사 정보를 수집하여 마크다운으로 저장합니다."
	@echo "  make test           - [Docker] URL 생성기 단위 테스트 실행"
	@echo "  make backfill       - [Docker] DB에 이미 저장된 상세 HTML의 추천공고 중 미수집 건 역추적하여 적재"
	@echo "  make check-worker   - [Host] Redis의 다운로드 큐 상태와 워커 컨테이너 상태를 확인합니다."
	@echo "  make clean          - [Host] 임시 파일 및 빈 폴더 정리"
	@echo "  make export-cron    - [Host] 현재 Cronicle 이벤트를 docker/cronicle/default.json으로 내보냅니다."
	@echo "  make init-cron      - [Host] 백업된 Cronicle 이벤트를 새로 기동된 컨테이너에 가져옵니다."
	@echo "========================================================================="

# Docker 이미지 빌드
build:
	docker compose build

# 호스트(Host) 구동 필수 타겟
login:
	npx ts-node src/crawler.ts login

open:
	npx ts-node src/browser/open.ts

kasm:
	docker compose exec -it kasm /bin/zsh

logout:
	rm -f config/session.json
	@echo "🔒 로그인 세션이 성공적으로 삭제되었습니다."

export-cron:
	@mkdir -p docker/cronicle
	docker compose exec -T cronicle /opt/cronicle/bin/control.sh export /app/docker/cronicle/default.json
	@echo "💾 Cronicle 이벤트가 docker/cronicle/default.json으로 성공적으로 백업되었습니다."

init-cron:
	@if [ ! -f "docker/cronicle/default.json" ]; then \
		echo "❌ 에러: docker/cronicle/default.json 파일이 존재하지 않습니다. 먼저 'make export-cron'을 실행해 주세요."; \
		exit 1; \
	fi
	docker compose stop cronicle
	docker compose run --rm cronicle /opt/cronicle/bin/storage-cli.js import /app/docker/cronicle/default.json
	docker compose start cronicle
	@echo "✅ Cronicle 이벤트 복원 및 재시작이 완료되었습니다."


# 호스트 가동 시 컨테이너로 위임(Proxy), 컨테이너 내부일 경우 실제 작업 수행
ifeq ($(IN_CONTAINER),true)

job-list:
	@if [ ! -f "$(LISTS)" ]; then \
		echo "❌ 에러: 수집 대상 설정 파일이 존재하지 않습니다: $(LISTS)"; \
		exit 1; \
	fi
	LOGIN=$(AUTH) PARALLEL=$(PARALLEL) SLEEP_TIME=$(SLEEP_TIME) npx ts-node src/crawler.ts list $(LISTS)

list: job-list

company:
	LOGIN=$(AUTH) npx ts-node src/company/company_pipeline.ts "data/compay/lists/urls.txt"

test:
	npx ts-node tests/url_manager.test.ts

backfill:
	npx ts-node src/jobs/backfill.ts

else

# 호스트 환경에서 컨테이너 구동으로 위임하는 인터페이스 프록시
list:
	docker compose run --rm --user $$(id -u):$$(id -g) -e IN_CONTAINER=true clipper make list LISTS=$(LISTS) AUTH=$(AUTH) PARALLEL=$(PARALLEL) SLEEP_TIME=$(SLEEP_TIME)

job-list: list

company:
	docker compose run --rm --user $$(id -u):$$(id -g) -e IN_CONTAINER=true clipper make company AUTH=$(AUTH)

test:
	docker compose run --rm --user $$(id -u):$$(id -g) -e IN_CONTAINER=true clipper make test

backfill:
	docker compose run --rm --user $$(id -u):$$(id -g) -e IN_CONTAINER=true clipper make backfill

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

