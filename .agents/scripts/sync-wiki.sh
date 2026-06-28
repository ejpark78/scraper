#!/bin/bash
# ==============================================================================
# 🤖 Agent Knowledge Base Compounding & Wiki Synchronizer (.agents/scripts/sync-wiki.sh)
# ==============================================================================
# @description 1. make agents-dump에 의해 갱신된 세션 로그 데이터를 획득합니다.
#              2. OpenKB 컴파일러를 실행하여 의미론적 마크다운 지식으로 정제합니다.
#              3. 정제된 문서를 Gitea Wiki Git 저장소 및 Obsidian 보관소에 Push/동기화합니다.
# @constraints
#              - SSL 인증서 에러 방지를 위해 git http.sslVerify=false 구동.
#              - GEMINI_API_KEY 환경변수 유효성을 체크합니다.
# ==============================================================================

set -e

PROJECT_ROOT="/Users/ejpark/workspace/scraper"
DUMP_DIR="${PROJECT_ROOT}/data/agents/agy"
OPENKB_DIR="${PROJECT_ROOT}/data/openkb"
WIKI_DIR="${PROJECT_ROOT}/data/gitea-wiki"

echo "🤖 Starting Gitea Wiki & OpenKB Sync Pipeline..."

# 1. API 키 확인
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  Warning: GEMINI_API_KEY is not defined. Using local fallback or OpenKB might fail."
fi

# 2. openkb raw 디렉토리로 최신 에이전트 덤프 파일 복사
echo "📁 Copying raw dump session memory into OpenKB raw store..."
mkdir -p "${OPENKB_DIR}/raw"

# 모든 세션 폴더에서 context_memory.md 검색 후 OpenKB raw 디렉토리에 고유 식별 명칭으로 복사
find "$DUMP_DIR" -type f -name "context_memory.md" | while read -r file; do
    # 경로에서 세션 ID 추출
    session_id=$(basename "$(dirname "$file")")
    target_name="${session_id}_context.md"
    
    if [ ! -f "${OPENKB_DIR}/raw/${target_name}" ] || [ "$file" -nt "${OPENKB_DIR}/raw/${target_name}" ]; then
        cp "$file" "${OPENKB_DIR}/raw/${target_name}"
        echo "   + Copied new/updated session context: $target_name"
    fi
done

# 3. OpenKB 지식 컴파일 실행 (Docker Compose 위임)
echo "🧠 Compiling knowledge via OpenKB inside Container (PageIndex)..."
# openkb 컨테이너를 실행하여 raw/ 안의 문서를 지식화합니다.
if [ "$(ls -A ${OPENKB_DIR}/raw)" ]; then
    docker compose -p scraper run --rm openkb add /data/openkb/raw/
else
    echo "   No raw logs found to compound."
fi

# 4. 컴파일 완료된 위키 파일들을 Gitea Wiki 저장소(data/gitea-wiki/)로 동기화
echo "🔄 Synchronizing compiled concepts & summaries to Gitea Wiki..."
mkdir -p "$WIKI_DIR"

# OpenKB에 의해 생성된 위키 파일들 복사 (concepts, summaries 하위 내용)
if [ -d "${OPENKB_DIR}/wiki/concepts" ]; then
    cp -r "${OPENKB_DIR}/wiki/concepts/"* "$WIKI_DIR/" 2>/dev/null || true
fi
if [ -d "${OPENKB_DIR}/wiki/summaries" ]; then
    mkdir -p "$WIKI_DIR/summaries"
    cp -r "${OPENKB_DIR}/wiki/summaries/"* "$WIKI_DIR/summaries/" 2>/dev/null || true
fi

# 5. Gitea Wiki 원격 저장소에 Commit & Push
echo "📤 Pushing to Gitea Wiki remote..."
cd "$WIKI_DIR"
git config http.sslVerify false

if [ -n "$(git status --porcelain)" ]; then
    git add .
    git commit -m "chore: auto-compound agent session logs $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin master
    echo "✅ Gitea Wiki Remote synchronisation complete."
else
    echo "   No changes detected in Wiki. Push skipped."
fi

echo "🎉 Wiki & OpenKB Compounding Pipeline run finished."
