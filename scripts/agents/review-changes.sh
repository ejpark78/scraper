#!/usr/bin/env bash

# ==============================================================================
# 🤖 review-changes.sh
# ==============================================================================
# Design Context: Extract git diffs of modified/staged files, fetch local AI guidelines,
#                 and run AI reviewer script to output a markdown report.
# Constraints:    Must run via ts-node in root workspace. Safe API key check.
# ==============================================================================

set -euo pipefail

# Ensure we are in project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

echo "🔍 Scanning code changes for AI Code Review..."

# Check if GEMINI_API_KEY is available (support common environment variables as fallback)
if [ -z "${GEMINI_API_KEY:-}" ]; then
  if [ -f .env ]; then
    # Parse GEMINI_API_KEY from .env safely without exporting all variables
    GEMINI_API_KEY_ENV=$(grep -E "^GEMINI_API_KEY=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -n "${GEMINI_API_KEY_ENV}" ]; then
      export GEMINI_API_KEY="${GEMINI_API_KEY_ENV}"
    fi
  fi
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "⚠️  WARNING: GEMINI_API_KEY environment variable is not set."
  echo "   Please set GEMINI_API_KEY in your environment or .env to enable AI review."
  exit 0
fi

# Get staged and unstaged diffs
echo "📄 Extracting git diffs..."
STAGED_DIFF=$(git diff --cached)
UNSTAGED_DIFF=$(git diff)

if [ -z "${STAGED_DIFF}" ] && [ -z "${UNSTAGED_DIFF}" ]; then
  echo "✨ No local code changes detected (working tree clean)."
  exit 0
fi

# Create a temporary diff file
TEMP_DIFF_FILE=$(mktemp)
echo "=== STAGED CHANGES ===" > "${TEMP_DIFF_FILE}"
echo "${STAGED_DIFF}" >> "${TEMP_DIFF_FILE}"
echo "=== UNSTAGED CHANGES ===" >> "${TEMP_DIFF_FILE}"
echo "${UNSTAGED_DIFF}" >> "${TEMP_DIFF_FILE}"

# Check if running inside a Docker container or if host has running docker worker container
IS_CONTAINER=false
if [ -f /.dockerenv ] || [ -f /run/.containerenv ]; then
  IS_CONTAINER=true
fi

# Detect running docker service "worker" for proxying
RUNNING_WORKER_ID=$(docker compose ps -q worker 2>/dev/null || echo "")

if [ "${IS_CONTAINER}" = "false" ] && [ -n "${RUNNING_WORKER_ID}" ]; then
  echo "🐳 Running code review inside Docker worker container..."
  
  # Copy temporary diff to container
  docker cp "${TEMP_DIFF_FILE}" "${RUNNING_WORKER_ID}:/tmp/review_diff.patch"
  
  # Run execution proxy inside docker compose context
  docker compose exec -T -e GEMINI_API_KEY="${GEMINI_API_KEY}" worker npx ts-node -T scripts/agents/ai-reviewer.ts "/tmp/review_diff.patch"
  
  # Cleanup inside container
  docker compose exec -T worker rm -f "/tmp/review_diff.patch"
else
  # Fallback to local execution if inside container or no docker container is running
  npx ts-node -T scripts/agents/ai-reviewer.ts "${TEMP_DIFF_FILE}"
fi

# Cleanup local temp file
rm -f "${TEMP_DIFF_FILE}"
