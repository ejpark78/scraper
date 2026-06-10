# Global Environment Variables for Scrapers
# 공통 환경변수 기본값 설정

LIST_SLACK       ?= 3
SCRAPER_SLACK    ?= 0
PRIORITY         ?= medium
OVERWRITE        ?= false
RECURSIVE_SCRAPE ?= true
AUTH             ?= false
CHUNK_SIZE       ?= 500
ERROR_RESET      ?= false

# Runtime Execution Wrapper
RUN_USER := --user $(shell id -u):$(shell id -g)
export RUN_USER

# Dynamic Environment Variable string construction
# Note: We use a function-like approach to collect active variables
# Since Makefile doesn't have easy array/map, we define the common set
ENV_COMMON := -e LIST_SLACK=$(LIST_SLACK) -e SCRAPER_SLACK=$(SCRAPER_SLACK) -e PRIORITY=$(PRIORITY) -e OVERWRITE=$(OVERWRITE) -e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE) -e AUTH=$(AUTH) -e CHUNK_SIZE=$(CHUNK_SIZE) -e ERROR_RESET=$(ERROR_RESET)
export ENV_COMMON