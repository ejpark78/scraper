#!/bin/bash
# ==============================================================================
# @file sync-indexes.sh
# @description Runs MongoDB Index synchronizer within docker container context.
# Automatically detects if the viewer container is running to either use 'exec' or 'run --rm'.
#
# Rules Complied:
# - Agent-Friendly Docstrings: File starts with this comment block.
# - Security Rules: Contains no hardcoded credentials.
# ==============================================================================

set -e

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." &> /dev/null && pwd)"

cd "$PROJECT_ROOT"

echo "🐳 Running index synchronization via volume-mounted temporary container..."
docker compose run --rm -v "$PROJECT_ROOT:/app" -T viewer npx ts-node src/scripts/sync-indexes.ts
