# ⚙️ LinkedIn Job Scraper Makefile
# 이 파일은 최상위(Root) 디렉토리에서 scripts/ 폴더 내부의 셸 스크립트를 편리하게 제어하기 위한 인터페이스입니다.

.PHONY: help posts urls html2md clean purge login list

# 기본 대상 (아무런 인자 없이 'make'만 실행했을 때 도움말 표시)
help:
	@echo "========================================================================="
	@echo "🌐 LinkedIn Job Scraper CLI"
	@echo "========================================================================="
	@echo "사용 가능한 명령어 목록:"
	@echo "  make login          - 1회성 브라우저를 띄워 로그인 세션(session.json)을 로컬에 덤프합니다."
	@echo "  make list           - list/config.list의 검색 URL에서 목록 HTML을 무인 수집하여 덤프합니다."
	@echo "  make posts          - list/urls.txt의 URL을 순차 수집하여 마크다운으로 저장합니다."
	@echo "                        (예: make posts URLS=list/custom_urls.txt)"
	@echo "  make urls           - list/*.html 에서 공고 조회 URL을 추출하여 urls.txt에 저장합니다."
	@echo "  make html2md        - html/inbox 내 HTML 캐시와 posts/inbox 내 MD 간 유실 파일을 동기화합니다."
	@echo "                        (단일 변환 예시: make html2md HTML=입력.html MD=출력.md)"
	@echo "  make clean          - 작업 중 생성된 임시 파일 및 비어 있는 폴더를 정리합니다."
	@echo "  make purge          - 수집된 html 및 posts 폴더를 완전히 삭제하고 초기화합니다."
	@echo "========================================================================="
	
# URLS 변수 기본값 설정 (make posts URLS=경로 형태로 덮어쓰기 가능)
URLS ?= list/urls.txt
# LISTS 변수 기본값 설정 (make list LISTS=경로 형태로 덮어쓰기 가능)
LISTS ?= list/config.list

# 1회성 로그인 세션 획득기 기동
login:
	node src/login.js

# 채용 목록 자동 스크롤 및 무인 덤프 실행
list:
	@if [ ! -f "list/session.json" ]; then \
		echo "❌ 에러: 로그인 세션이 존재하지 않습니다. 먼저 [make login]을 기동하여 로그인해 주세요."; \
		exit 1; \
	fi
	@if [ ! -f "$(LISTS)" ]; then \
		echo "❌ 에러: 수집 대상 목록 파일이 존재하지 않습니다: $(LISTS)"; \
		exit 1; \
	fi
	node src/get_list.js $(LISTS)

# 채용 공고 일괄 수집 및 가공 파이프라인 구동
posts:
	@if [ ! -f "$(URLS)" ]; then \
		echo "❌ 에러: 지정한 URL 목록 파일이 존재하지 않습니다: $(URLS)"; \
		exit 1; \
	fi
	bash scripts/get_posts.sh $(URLS)

# URL 추출 및 urls.txt 적재
urls:
	bash scripts/get_urls.sh

# HTML 백업본과 MD 파일 동기화 및 유실 파일 오프라인 일괄 복원
html2md:
	bash scripts/html2md.sh $(HTML) $(MD)


# 작업용 임시 파일 및 new/ 아카이브 폴더 정리 (최상위 html, posts 폴더 자체는 보존)
clean:
	rm -rf html/new posts/new
	rm -f temp_job_raw.md posts/temp_job_raw.md
	find html posts -mindepth 1 -type d -empty -delete 2>/dev/null || true
	@echo "🧹 임시 파일, new 폴더 및 빈 디렉토리 정리가 완료되었습니다."

# 전체 데이터 초기화 (html 및 posts 디렉토리 완전 삭제)
purge:
	@echo "⚠️  [경고] 수집된 모든 HTML 파일과 마크다운 포스트를 완전히 삭제합니다."
	@read -p "정말 진행하시겠습니까? [y/N]: " confirm && [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ] || (echo "❌ 중단되었습니다."; exit 1)
	rm -rf html posts
	@echo "✨ html/ 및 posts/ 디렉토리가 완전히 초기화되었습니다."
