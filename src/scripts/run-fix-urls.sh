#!/bin/bash
# ==============================================================================
# @module run-fix-urls.sh
# @description Runs the URL and queue cleanup TypeScript script (fix-urls.ts) in a temporary docker container.
# @constraints
#   - Must use 'docker compose run --rm' with volume mounting to avoid docker cp.
#   - Depends on the 'clipper' service from docker compose.
# @dependencies docker compose, src/scripts/fix-urls.ts
# @lastUpdated 2026-06-11
# ==============================================================================
set -e

# 프로젝트 루트 경로 확보
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🧼 Starting Target URL & Queue Cleanup via docker compose run..."

# 로컬 스크립트 폴더를 마운트하여 1회성 컨테이너로 즉시 실행
docker compose -p linkedin run --rm \
  -v "$PROJECT_ROOT/src/scripts:/app/src/scripts" \
  clipper \
  npx ts-node src/scripts/fix-urls.ts

echo "🎉 Cleanup complete!"
