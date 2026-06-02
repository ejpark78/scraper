#!/usr/bin/env bash

# ⚙️ LinkedIn URL 추출 및 중복 방지 정제 스크립트
# lists/ 및 html/ 하위의 모든 html 에서 공고 조회 URL을 추출하되,
# 이미 data/jobs/html/ 하위에 다운로드 완료된 HTML이 존재하는 ID의 URL은 완벽하게 제외하고 저장합니다.

URLS_FILE="data/jobs/lists/urls.txt"
TEMP_CACHE=$(mktemp)
TEMP_EXTRACTED=$(mktemp)

# 1. 📂 이미 다운로드 완료된 모든 HTML 파일의 ID를 누수 없이 안전하게 수집
find data/jobs/html/ -type f -name "*.html" 2>/dev/null | awk -F'/' '{print $NF}' | sed 's/\.html$//' | sort -u > "$TEMP_CACHE"

# 2. 🔍 lists/ 및 html/ 내의 파일들에서 공고 URL을 추출 및 1차 정제 (중복 제거)
find data/jobs/lists/ data/jobs/html/ -type f -name "*.html" -exec cat {} + 2>/dev/null \
    | grep -oP 'href="\K[^"]+' \
    | grep /view/ \
    | sed -E -e 's/\/?\?.*/\//' -e 's|^\/jobs|https://www.linkedin.com/jobs|' \
    | sort -u > "$TEMP_EXTRACTED"

# 3. 🛡️ 추출된 URL 중 이미 다운로드된 ID를 가진 URL은 정밀 차단하고 신규 URL만 최종 적재 (JS 초고속 모듈 호출)
node src/filter_urls.js "$TEMP_CACHE" "$TEMP_EXTRACTED" "${URLS_FILE}"

# 🧹 임시 파일 정리
rm -f "$TEMP_CACHE" "$TEMP_EXTRACTED"

RAW_COUNT=$(wc -l < "${URLS_FILE}" 2>/dev/null || echo 0)
FMT_COUNT=$(echo "$RAW_COUNT" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')
echo "✅ 이미 수집된 대상을 제외하고 총 ${FMT_COUNT} 개의 신규 URL을 ${URLS_FILE}에 깔끔하게 저장했습니다."
