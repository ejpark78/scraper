#!/bin/bash

# ==============================================================================
# 🤖 commit-changes.sh
# ==============================================================================
# Design Context: Automatically stage and commit all modified/untracked files.
#                 Outputs structured, color-coded visual diffs with line numbers.
# Constraints:    Detects binary files via git --numstat (avoids self-referential 
#                 grep loops). Runs automatically after valid edits.
# Dependencies:   git, awk, bash (v4+)
# ==============================================================================

# Parse arguments
AUTO_MERGE=true
for arg in "$@"; do
  if [ "$arg" = "--no-merge" ]; then
    AUTO_MERGE=false
  fi
done

# staged 파일의 상세 diff를 파싱하여 출력하는 헬퍼 함수
show_file_diff() {
  local file="$1"
  local abs_path="$(pwd)/$file"
  local status="$2"
  
  # Action 명칭 결정
  local action="Edit"
  if [ "$status" = "A" ]; then
    action="Create"
  elif [ "$status" = "D" ]; then
    action="Delete"
  fi
  
  echo "● ${action}(${abs_path})"
  
  # 추가/삭제 라인 수 계산 (git diff --numstat)
  local numstat=$(git diff --cached --numstat -- "$file")
  local added=$(echo "$numstat" | awk '{print $1}')
  local deleted=$(echo "$numstat" | awk '{print $2}')
  
  added=${added:-0}
  deleted=${deleted:-0}
  
  echo "  ⎿  +${added} / -${deleted} lines"
  
  # 바이너리 파일 예외 처리 (numstat에서 -로 표시됨)
  if [ "$added" = "-" ] || [ "$deleted" = "-" ]; then
    echo "       [Binary file]"
    return
  fi
  
  local line_old=0
  local line_new=0
  
  # git diff 출력을 한 줄씩 읽어 줄 번호와 변경 내역 파싱
  git diff --cached -U3 -- "$file" | while IFS= read -r line; do
    # diff 헤더 생략
    if [[ "$line" =~ ^diff ]] || [[ "$line" =~ ^index ]] || [[ "$line" =~ ^--- ]] || [[ "$line" =~ ^\+\+\+ ]]; then
      continue
    fi
    
    # 헌크 헤더 파싱 (예: @@ -17,5 +17,5 @@)
    if [[ "$line" =~ ^@@\ -([0-9]+),?([0-9]*)\ \+([0-9]+),?([0-9]*)\ @@ ]]; then
      line_old="${BASH_REMATCH[1]}"
      line_new="${BASH_REMATCH[3]}"
      continue
    fi
    
    # 헌크 범위 밖의 라인은 무시
    if [ "$line_old" -eq 0 ] && [ "$line_new" -eq 0 ]; then
      continue
    fi
    
    # 변경 내역 상세 포맷팅
    if [[ "$line" =~ ^-(.*) ]]; then
      local content="${BASH_REMATCH[1]}"
      printf "       %-4d - %s\n" "$line_old" "$content"
      line_old=$((line_old + 1))
    elif [[ "$line" =~ ^\+(.*) ]]; then
      local content="${BASH_REMATCH[1]}"
      printf "       %-4d + %s\n" "$line_new" "$content"
      line_new=$((line_new + 1))
    elif [[ "$line" =~ ^\ (.*) ]]; then
      local content="${BASH_REMATCH[1]}"
      printf "       %-4d   %s\n" "$line_new" "$content"
      line_old=$((line_old + 1))
      line_new=$((line_new + 1))
    elif [[ "$line" = "" ]]; then
      printf "       %-4d   \n" "$line_new"
      line_old=$((line_old + 1))
      line_new=$((line_new + 1))
    fi
  done
  echo ""
}

# Ensure git detects changes
if [ -n "$(git status --porcelain)" ]; then
  # Get current branch name
  BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)

  # Prevent direct commit to main branch
  if [ "$BRANCH_NAME" = "main" ]; then
    echo "❌ ERROR: Direct commit to 'main' branch is strictly prohibited by Git Flow guidelines." >&2
    echo "   Please create or checkout a feature or develop branch first." >&2
    exit 1
  fi

  # 실행 가능한 AI 코드 리뷰 수행
  if [ -f "scripts/agents/review-changes.sh" ]; then
    echo "🤖 Running AI Code Review Check..."
    if ! bash scripts/agents/review-changes.sh; then
      echo "⚠️ AI Review check script failed to run. Proceeding with commit..."
    fi
  fi

  # 변경이 일어난 패키지 식별 및 개별 test.sh 실행
  echo "🔍 Running static verification tests..."
  
  # 변경된 파일 목록 파싱
  STAGED_FILES=$(git status --porcelain | awk '{print $2}')
  
  # 각 패키지별 검사 트리거링 플래그
  RUN_CRAWLER=false
  RUN_VIEWER=false
  RUN_EBOOK=false

  for file in $STAGED_FILES; do
    if [[ "$file" =~ ^apps/crawler/ ]]; then
      RUN_CRAWLER=true
    elif [[ "$file" =~ ^apps/viewer/ ]]; then
      RUN_VIEWER=true
    elif [[ "$file" =~ ^apps/ebook/ ]]; then
      RUN_EBOOK=true
    fi
  done

  # crawler 검증
  if [ "$RUN_CRAWLER" = true ]; then
    if [ -f "apps/crawler/scripts/lint.sh" ]; then
      echo "🏃 Executing apps/crawler/scripts/lint.sh..."
      chmod +x apps/crawler/scripts/lint.sh
      if ! ./apps/crawler/scripts/lint.sh; then
        echo "❌ ERROR: Crawler static check failed!" >&2
        exit 1
      fi
    fi
  fi

  # viewer 검증
  if [ "$RUN_VIEWER" = true ]; then
    if [ -f "apps/viewer/scripts/lint.sh" ]; then
      echo "🏃 Executing apps/viewer/scripts/lint.sh..."
      chmod +x apps/viewer/scripts/lint.sh
      if ! ./apps/viewer/scripts/lint.sh; then
        echo "❌ ERROR: Viewer static check failed!" >&2
        exit 1
      fi
    fi
  fi

  # ebook 검증
  if [ "$RUN_EBOOK" = true ]; then
    if [ -f "apps/ebook/scripts/lint.sh" ]; then
      echo "🏃 Executing apps/ebook/scripts/lint.sh..."
      chmod +x apps/ebook/scripts/lint.sh
      if ! ./apps/ebook/scripts/lint.sh; then
        echo "❌ ERROR: Ebook static check failed!" >&2
        exit 1
      fi
    fi
  fi


  echo "🔄 Detecting modifications..."
  
  # Stage all modifications and untracked files
  git add .


  # 변경 상세 내역 출력
  git diff --cached --name-status | while read -r status file; do
    show_file_diff "$file" "$status"
  done

  # Get current branch name
  BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
  MSG=""

  # Check if branch name matches feature/###-description or hotfix/###-description
  if [[ "$BRANCH_NAME" =~ ^feature/([0-9]{3})-(.+)$ ]]; then
    NUM="${BASH_REMATCH[1]}"
    DESC="${BASH_REMATCH[2]}"
    DESC_SPACE=$(echo "$DESC" | tr '-' ' ')
    MSG="feat(${NUM}): ${DESC_SPACE}"
  elif [[ "$BRANCH_NAME" =~ ^hotfix/([0-9]{3})-(.+)$ ]]; then
    NUM="${BASH_REMATCH[1]}"
    DESC="${BASH_REMATCH[2]}"
    DESC_SPACE=$(echo "$DESC" | tr '-' ' ')
    MSG="fix(${NUM}): ${DESC_SPACE}"
  fi

  # Fallback to file-based inference if branch name does not match Git Flow pattern
  if [ -z "$MSG" ]; then
    MSG="chore: commit changes"
    STAGED_FILES=$(git diff --cached --name-only)
    
    if echo "$STAGED_FILES" | grep -qE "AGENTS.md|\.agents/rules/"; then
      MSG="docs: update agent rules"
    elif echo "$STAGED_FILES" | grep -q "src/crawler/workers/ConverterWorker.ts"; then
      MSG="feat(crawler): retain original image URLs and append collected metadata"
    elif echo "$STAGED_FILES" | grep -q "src/"; then
      MSG="feat: update scraper/converter implementation"
    fi
  fi

  git commit -m "$MSG" > /dev/null
  echo "✅ Committed: $MSG"

  if [ "$AUTO_MERGE" = true ]; then
    FEAT_BRANCH="$BRANCH_NAME"
    if [ "$FEAT_BRANCH" != "develop" ] && [ "$FEAT_BRANCH" != "main" ]; then
      echo "🔀 Auto-merge option detected. Transitioning to develop..."
      if git checkout develop; then
        if git merge "$FEAT_BRANCH"; then
          echo "✅ Successfully merged $FEAT_BRANCH into develop branch."
        else
          echo "❌ ERROR: Merge conflict detected! Please resolve conflicts manually." >&2
          exit 1
        fi
      else
        echo "❌ ERROR: Failed to checkout develop branch." >&2
        exit 1
      fi
    fi
  fi
else
  echo "✨ No changes to commit."

  if [ "$AUTO_MERGE" = true ]; then
    BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
    FEAT_BRANCH="$BRANCH_NAME"
    if [ "$FEAT_BRANCH" != "develop" ] && [ "$FEAT_BRANCH" != "main" ]; then
      echo "🔀 Auto-merge option detected (No changes). Transitioning to develop..."
      if git checkout develop; then
        if git merge "$FEAT_BRANCH"; then
          echo "✅ Successfully merged $FEAT_BRANCH into develop branch."
        else
          echo "❌ ERROR: Merge conflict detected!" >&2
          exit 1
        fi
      else
        echo "❌ ERROR: Failed to checkout develop." >&2
        exit 1
      fi
    fi
  fi
fi
