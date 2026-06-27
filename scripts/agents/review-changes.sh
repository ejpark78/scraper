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

# Run the TypeScript reviewer script
npx ts-node -T scripts/agents/ai-reviewer.ts "${TEMP_DIFF_FILE}"

# Cleanup
rm -f "${TEMP_DIFF_FILE}"
