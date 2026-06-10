#!/bin/bash
# ==============================================================================
# @module dump-queue.sh
# @description Runs the queue dumper script (dump-queue.ts) inside a temporary docker container.
# @constraints
#   - Must use 'docker compose run --rm' with volume mounting for scripts and data folder.
#   - Exposes local data/ directory to capture the JSON output.
# @dependencies docker compose, src/scripts/dump-queue.ts
# @lastUpdated 2026-06-11
# ==============================================================================
set -e

# 프로젝트 루트 경로 확보
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DUMP_FILE="data/queue_dump.json"

echo "📥 Dumping all active Redis scrape queues to [$DUMP_FILE]..."

# 로컬 scripts와 data 폴더를 마운트하여 실행
docker compose -p linkedin run --rm \
  -v "$PROJECT_ROOT/src/scripts:/app/src/scripts" \
  -v "$PROJECT_ROOT/data:/app/data" \
  clipper \
  npx ts-node src/scripts/dump-queue.ts

echo "🎉 Done! You can view the dump at: $PROJECT_ROOT/$DUMP_FILE"
