#!/bin/bash
set -e

# Project root directory detection
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SRC_FILE="src/scripts/clean-logout-urls.ts"
DEST_FILE="/app/src/scripts/clean-logout-urls.ts"

echo "=========================================================="
echo "🧼 Uppity Logout URL Cleanup Runner"
echo "=========================================================="

# 1. Find a running clipper/worker container
echo "🔍 Finding running clipper/worker container..."
CONTAINER_ID=$(docker ps --filter "ancestor=linkedin/clipper:latest" --filter "status=running" -q | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    # Fallback to look by name
    CONTAINER_ID=$(docker ps --filter "name=clipper" --filter "status=running" -q | head -n 1)
fi

if [ -z "$CONTAINER_ID" ]; then
    echo "❌ No running clipper/worker containers found."
    echo "💡 Please start the infrastructure first (e.g., 'make up') or run via Docker Compose run:"
    echo "   docker compose -p linkedin run --rm clipper npx ts-node src/scripts/clean-logout-urls.ts"
    exit 1
fi

CONTAINER_NAME=$(docker inspect --format='{{.Name}}' "$CONTAINER_ID" | sed 's/\///')
echo "✅ Found active container: $CONTAINER_NAME ($CONTAINER_ID)"

# 2. Ensure destination directory exists in container
echo "📁 Ensuring target directories exist in the container..."
docker exec "$CONTAINER_ID" mkdir -p /app/src/scripts

# 3. Copy TypeScript script into the container
echo "📤 Copying $SRC_FILE to container..."
docker cp "$PROJECT_ROOT/$SRC_FILE" "$CONTAINER_ID:$DEST_FILE"

# 4. Run the script inside the container using npx ts-node
echo "🚀 Running the cleanup script inside the container..."
docker exec -i "$CONTAINER_ID" npx ts-node "$DEST_FILE"

# 5. Clean up the script inside the container
echo "🧹 Cleaning up temporary script from container..."
docker exec "$CONTAINER_ID" rm -f "$DEST_FILE"

echo "🎉 Done!"
