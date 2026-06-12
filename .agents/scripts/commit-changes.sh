#!/bin/bash
# ==============================================================================
# 🤖 commit-changes.sh Compatibility Wrapper (.agents/scripts/commit-changes.sh)
# ==============================================================================
# Design Context: Routes calls from old path to new location scripts/agents/commit-changes.sh.
# Dependencies:   bash, ../../scripts/agents/commit-changes.sh
# ==============================================================================

# Find repository root
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$DIR/../.." && pwd )"

# Run the real commit script from the repo root
cd "$REPO_ROOT"
bash scripts/agents/commit-changes.sh "$@"
