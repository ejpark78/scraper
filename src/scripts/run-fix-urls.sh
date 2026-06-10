#!/bin/bash
# ==============================================================================
# @module run-fix-urls.sh
# @description Runs the URL and queue cleanup TypeScript script (fix-urls.ts) and shows before/after queue status.
# @constraints
#   - Must use 'docker compose run --rm' with volume mounting to avoid docker cp.
#   - Depends on the 'clipper' service from docker compose.
# @dependencies docker compose, src/scripts/fix-urls.ts, src/scripts/get-queue-status.ts
# @lastUpdated 2026-06-11
# ==============================================================================
set -e

# 프로젝트 루트 경로 확보
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== 📊 [BEFORE] Redis Queue Status ==="
docker compose -p linkedin run --rm \
  -v "$PROJECT_ROOT/src/scripts:/app/src/scripts" \
  clipper \
  npx ts-node src/scripts/get-queue-status.ts

echo "🧼 Starting Target URL & Queue Cleanup..."
docker compose -p linkedin run --rm \
  -v "$PROJECT_ROOT/src/scripts:/app/src/scripts" \
  clipper \
  npx ts-node src/scripts/fix-urls.ts

echo "=== 📊 [AFTER] Redis Queue Status ==="
docker compose -p linkedin run --rm \
  -v "$PROJECT_ROOT/src/scripts:/app/src/scripts" \
  clipper \
  npx ts-node src/scripts/get-queue-status.ts

echo "🎉 Cleanup process complete!"
