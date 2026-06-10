#!/bin/bash
set -e

# 프로젝트 루트 경로 확보
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🧼 Starting Uppity Logout URL Cleanup via docker compose run..."

# 로컬 스크립트 폴더를 마운트하여 1회성 컨테이너로 즉시 실행
docker compose -p linkedin run --rm \
  -v "$PROJECT_ROOT/src/scripts:/app/src/scripts" \
  clipper \
  npx ts-node src/scripts/clean-logout-urls.ts

echo "🎉 Cleanup complete!"
