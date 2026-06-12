# ==============================================================================
# 🤖 Agent Infrastructure Compatibility Wrapper (.agents/Makefile)
# ==============================================================================
# Design Context: Routes compatibility commands from old paths to root Makefile with prefix.
# Dependencies:   make, ../Makefile, ../scripts/agents.mk
# ==============================================================================

SHELL := /bin/bash

REPO_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))..)

.PHONY: dump-transcripts dump-context dump-brain dump-sysinfo compress-rules lint-rules usage prune dump-all commit get-agy-token

get-agy-token:
	@$(MAKE) -C $(REPO_ROOT) agents-get-agy-token

dump-transcripts:
	@$(MAKE) -C $(REPO_ROOT) agents-dump-transcripts

dump-context:
	@$(MAKE) -C $(REPO_ROOT) agents-dump-context

dump-brain:
	@$(MAKE) -C $(REPO_ROOT) agents-dump-brain

dump-sysinfo:
	@$(MAKE) -C $(REPO_ROOT) agents-dump-sysinfo

compress-rules:
	@$(MAKE) -C $(REPO_ROOT) agents-compress-rules

lint-rules:
	@$(MAKE) -C $(REPO_ROOT) agents-lint-rules

usage:
	@$(MAKE) -C $(REPO_ROOT) agents-usage

prune:
	@$(MAKE) -C $(REPO_ROOT) agents-prune

dump-all:
	@$(MAKE) -C $(REPO_ROOT) agents-dump-all

commit:
	@$(MAKE) -C $(REPO_ROOT) agents-commit
