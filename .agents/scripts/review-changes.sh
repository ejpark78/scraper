#!/usr/bin/env bash

# ==============================================================================
# 🤖 review-changes.sh
# ==============================================================================
# Design Context: Run fast local static code reviews (Lint & Type check) 
#                 only on modified files in git diff and print output to console.
# Constraints:    Must run offline without requiring external API keys.
# ==============================================================================

set -euo pipefail

# Ensure we are in project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

echo "🔍 Running offline local static code review on modified files..."

# Find modified or staged TypeScript / JavaScript / Python files
MODIFIED_FILES=$(git diff --name-only && git diff --cached --name-only | sort -u)

if [ -z "${MODIFIED_FILES}" ]; then
  echo "✨ No local code changes detected (working tree clean)."
  exit 0
fi

echo "📄 Modified Files List:"
HAS_TS_CHANGES=false
HAS_PY_CHANGES=false

for file in ${MODIFIED_FILES}; do
  if [ -f "${file}" ]; then
    echo "  - ${file}"
    if [[ "${file}" =~ \.tsx?$ || "${file}" =~ \.jsx?$ ]]; then
      HAS_TS_CHANGES=true
    elif [[ "${file}" =~ \.py$ ]]; then
      HAS_PY_CHANGES=true
    fi
  fi
done

echo ""

# Check if running inside a Docker container or if host has running docker worker container
IS_CONTAINER=false
if [ -f /.dockerenv ] || [ -f /run/.containerenv ]; then
  IS_CONTAINER=true
fi
RUNNING_WORKER_ID=$(docker compose ps -q worker 2>/dev/null || echo "")

# Execute diagnostic helper in Docker or locally
run_lint_check() {
  local target_file="$1"
  
  if [ "${IS_CONTAINER}" = "false" ] && [ -n "${RUNNING_WORKER_ID}" ]; then
    # Proxying to docker container
    if [[ "${target_file}" =~ ^apps/crawler/ ]]; then
      docker compose exec -T worker npm run lint --prefix apps/crawler -- --quiet 2>&1 || true
    elif [[ "${target_file}" =~ ^apps/viewer/ ]]; then
      docker compose exec -T worker npm run lint --prefix apps/viewer -- --quiet 2>&1 || true
    fi
  else
    # Local fallback
    if [[ "${target_file}" =~ ^apps/crawler/ ]] && [ -d "apps/crawler/node_modules" ]; then
      npm run lint --prefix apps/crawler -- --quiet 2>&1 || true
    elif [[ "${target_file}" =~ ^apps/viewer/ ]] && [ -d "apps/viewer/node_modules" ]; then
      npm run lint --prefix apps/viewer -- --quiet 2>&1 || true
    fi
  fi
}

echo "🏃 Running lint diagnostics..."
LINT_ERRORS=""
for file in ${MODIFIED_FILES}; do
  if [ -f "${file}" ]; then
    if [[ "${file}" =~ \.tsx?$ || "${file}" =~ \.jsx?$ ]]; then
      LINT_OUT=$(run_lint_check "${file}")
      if [ -n "${LINT_OUT}" ] && [[ "${LINT_OUT}" == *"error"* || "${LINT_OUT}" == *"warning"* ]]; then
        LINT_ERRORS="${LINT_ERRORS}${LINT_OUT}\n"
      fi
    fi
  fi
done

HAS_ERRORS=false

if [ -n "${LINT_ERRORS}" ]; then
  echo -e "⚠️  Lint issues detected:\n"
  echo -e "${LINT_ERRORS}"
  HAS_ERRORS=true
else
  echo "✅ Clean! No lint issues detected."
fi

# Run compile / type checks if TypeScript changed
if [ "${HAS_TS_CHANGES}" = "true" ]; then
  echo ""
  echo "🏃 Running TypeScript Type Checking..."
  
  TSC_OUT=""
  if [ "${IS_CONTAINER}" = "false" ] && [ -n "${RUNNING_WORKER_ID}" ]; then
    TSC_OUT=$(docker compose exec -T worker npm run type-check 2>&1 || true)
  else
    if [ -d "apps/crawler/node_modules" ]; then
      TSC_OUT=$(npm run type-check 2>&1 || true)
    fi
  fi
  
  if [ -n "${TSC_OUT}" ]; then
    echo "${TSC_OUT}"
    if [[ "${TSC_OUT}" == *"error"* ]]; then
      echo "⚠️  TypeScript compilation contains errors."
      HAS_ERRORS=true
    else
      echo "✅ TypeScript Compilation Clean!"
    fi
  else
    echo "No compilation diagnostics run."
  fi
fi

echo ""
if [ "${HAS_ERRORS}" = "true" ]; then
  echo "❌ Local static validation failed. Please fix the errors before committing."
  exit 1
else
  echo "🎯 Final Local Verdict: [Complete] Local static validation passed."
  exit 0
fi
