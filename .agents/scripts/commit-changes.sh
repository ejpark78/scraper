#!/bin/bash

# Ensure git detects changes
if [ -n "$(git status --porcelain)" ]; then
  echo "🔄 Detecting modifications..."
  
  # Stage all modifications and untracked files
  git add .

  # Infer a reasonable commit message based on modified files
  MSG="chore: commit changes"
  
  # Check which files are staged to make the message more informative
  STAGED_FILES=$(git diff --cached --name-only)
  
  if echo "$STAGED_FILES" | grep -q "AGENTS.md"; then
    MSG="docs: update AGENTS.md rules"
  elif echo "$STAGED_FILES" | grep -q "src/crawler/workers/TransformerWorker.ts"; then
    MSG="feat(crawler): retain original image URLs and append collected metadata"
  elif echo "$STAGED_FILES" | grep -q "src/"; then
    MSG="feat: update scraper/transformer implementation"
  fi

  git commit -m "$MSG"
  echo "✅ Committed: $MSG"
else
  echo "✨ No changes to commit."
fi
