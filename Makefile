# ⚙️ LinkedIn Job Scraper Makefile

.PHONY: help posts urls html2md clean purge login list job-list test migrate open logout build kasm

# URLS 변수 기본값 설정
URLS ?= data/jobs/lists/urls.txt
# LISTS 변수 기본값 설정
LISTS ?= config/config.json
# 동시 실행 브라우저 갯수 기본값
PARALLEL ?= 1
# AUTH 기본값
AUTH ?= true

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
	@echo "  make jobs           - [Docker] urls.txt의 URL을 병렬 수집하여 마크다운으로 저장합니다."
	@echo "  make urls           - [Docker] lists/raw/*.html 에서 공고 조회 URL을 추출하여 urls.txt에 저장합니다."
	@echo "  make company        - [Docker] urls.txt 기반 회사 정보를 수집하여 마크다운으로 저장합니다."
	@echo "  make html2md        - [Docker] HTML 캐시와 MD 간 동기화 및 메타데이터 일괄 복원"
	@echo "  make migrate        - [Docker] 수집 데이터 표준 국가명 폴더로 일괄 마이그레이션"
	@echo "  make test           - [Docker] URL 생성기 단위 테스트 실행"
	@echo "  make clean          - [Host] 임시 파일 및 빈 폴더 정리"
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
	docker compose exec -it kasm /bin/bash

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
	LOGIN=$(AUTH) PARALLEL=$(PARALLEL) npx ts-node src/crawler.ts list $(LISTS)

list: job-list

jobs:
	@if [ ! -f "$(URLS)" ]; then \
		echo "❌ 에러: 지정한 URL 목록 파일이 존재하지 않습니다: $(URLS)"; \
		exit 1; \
	fi
	LOGIN=$(AUTH) PARALLEL=$(PARALLEL) npx ts-node src/jobs/jobs_pipeline.ts $(URLS)

urls:
	node --max-old-space-size=4096 -r ts-node/register src/jobs/url_manager.ts extract "data/jobs/lists/raw/" "data/jobs/html/" "data/jobs/lists/urls.txt"

html2md:
	npx ts-node src/jobs/jobs_converter.ts $(HTML) $(MD)
	npx ts-node src/company/reconvert_all.ts

migrate:
	npx ts-node src/jobs/migrate_locations.ts

company:
	LOGIN=$(AUTH) npx ts-node src/company/company_pipeline.ts "data/compay/lists/urls.txt"

test:
	npx ts-node tests/url_manager.test.ts

else

# 호스트 환경에서 컨테이너 구동으로 위임하는 인터페이스 프록시
list:
	docker compose run --rm --user $$(id -u):$$(id -g) -e IN_CONTAINER=true clipper make list LISTS=$(LISTS) AUTH=$(AUTH) PARALLEL=$(PARALLEL)

job-list: list

jobs:
	docker compose run --rm --user $$(id -u):$$(id -g) -e IN_CONTAINER=true clipper make jobs URLS=$(URLS) AUTH=$(AUTH) PARALLEL=$(PARALLEL)

urls:
	docker compose run --rm --user $$(id -u):$$(id -g) -e IN_CONTAINER=true clipper make urls

html2md:
	docker compose run --rm --user $$(id -u):$$(id -g) -e IN_CONTAINER=true clipper make html2md HTML=$(HTML) MD=$(MD)

migrate:
	docker compose run --rm --user $$(id -u):$$(id -g) -e IN_CONTAINER=true clipper make migrate

company:
	docker compose run --rm --user $$(id -u):$$(id -g) -e IN_CONTAINER=true clipper make company AUTH=$(AUTH)

test:
	docker compose run --rm --user $$(id -u):$$(id -g) -e IN_CONTAINER=true clipper make test

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
	rm -rf data/jobs/lists/raw/*.html
	@echo "🧹 data/jobs/lists/raw/ HTML 파일이 모두 삭제되었습니다."

purge:
	@echo "⚠️  [경고] 수집된 모든 HTML 파일과 마크다운 포스트를 완전히 삭제합니다."
	@read -p "정말 진행하시겠습니까? [y/N]: " confirm && [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ] || (echo "❌ 중단되었습니다."; exit 1)
	rm -rf data/jobs
	@echo "✨ data/jobs 디렉토리가 완전히 초기화되었습니다."
