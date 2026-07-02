# ==============================================================================
# 🤖 Design Context & Constraints (AGENTS.md Compliance)
# ==============================================================================
# @module Makefile
# @description Compatibility entrypoint for legacy Make targets. Docker runtime tasks are routed through Taskfile.yml.
# @constraints
#   - Do NOT execute make commands or custom bash scripts without explicit user permission.
#   - Prefer `task ...` commands for Docker runtime control.
# @dependencies GNU Make, Task, docker compose
# @lastUpdated 2026-07-02
# ==============================================================================

.PHONY: *

lint:
	task config

mkcert:
	task mkcert

build up down logs:
	task $@

up-gitea:
	task infra:gitea:up

up-obsidian:
	task tool:obsidian:up

down-obsidian:
	task tool:obsidian:down

up-me:
	task infra:mongodb:gui:up

up-redis:
	task infra:redis:gui:up

gitea-token:
	task infra:gitea:token

ollama-run ollama-logs ollama-ps ollama-stop:
	task $(subst -,:,$@)

# crawler app forwarding
list refresh-urls refresh-silver rebuild restart clear-queue grep-errors dump-queue fix-urls get-queue-status extract debug:
	@$(MAKE) -C apps/crawler $@

test-%:
	@$(MAKE) -C apps/crawler $@

gm-%:
	@$(MAKE) -C apps/crawler gmail-$*

gpt-% gn-% ddds-% pk-% ab-% up-% mj-% yz-% li-%:
	@$(MAKE) -C apps/crawler $@

# db utils
mongo-%:
	task infra:mongodb:$*

# agent utils
agents-%:
	@$(MAKE) -f .agents/scripts/agents.mk $*

# meili utils
ms-%:
	task infra:meilisearch:$*

# ebook utils
ebook-%:
	@$(MAKE) -C apps/ebook $* PDF="$(PDF)" RANGE="$(RANGE)" OUT="$(OUT)"

# viewer utils
viewer-%:
	@$(MAKE) -C apps/viewer $*

# openkb utils
openkb-%:
	@$(MAKE) -C apps/openkb $* MODEL="$(MODEL)" RAW="$(RAW)" SAMPLE="$(SAMPLE)"
