#!/bin/bash

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
  echo "🔄 Detecting modifications..."
  
  # Stage all modifications and untracked files
  git add .

  # 변경 상세 내역 출력
  git diff --cached --name-status | while read -r status file; do
    show_file_diff "$file" "$status"
  done

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

  git commit -m "$MSG" > /dev/null
  echo "✅ Committed: $MSG"
else
  echo "✨ No changes to commit."
fi
