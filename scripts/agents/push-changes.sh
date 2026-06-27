#!/usr/bin/env bash

# ==============================================================================
# 🤖 push-changes.sh
# ==============================================================================
# Design Context: Automates merging develop into main and pushing both branch
#                 tips to origin remote repository.
# Constraints:    Must preserve original branch (develop) state after operation.
# ==============================================================================

set -euo pipefail

# Ensure we are in project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Rule: This release automation expects origin/develop or local develop as baseline.
if [ "${CURRENT_BRANCH}" != "develop" ]; then
  echo "⚠️  WARNING: You are currently on branch '${CURRENT_BRANCH}' instead of 'develop'."
  echo "   Transitioning to 'develop' to run agents-push release sequence..."
  
  # If dirty files exist, fail fast
  if [ -n "$(git status --porcelain)" ]; then
    echo "❌ ERROR: Working directory contains uncommitted changes. Please commit or stash them first." >&2
    exit 1
  fi
  
  git checkout develop
fi

echo "🚀 Syncing local 'develop' to origin..."
git push origin develop

echo "🔀 Merging develop changes into main branch..."
if ! git checkout main; then
  echo "❌ ERROR: Failed to checkout main branch." >&2
  exit 1
fi

if ! git merge develop; then
  echo "❌ ERROR: Merge conflicts detected! Reverting to original develop branch." >&2
  git merge --abort || true
  git checkout develop
  exit 1
fi

echo "🚀 Syncing local 'main' to origin..."
git push origin main

echo "🔙 Returning to 'develop' branch..."
git checkout develop

echo "🎉 Successfully merged and pushed both main and develop branches."
