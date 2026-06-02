#!/usr/bin/env bash

# 1. 파라미터 입력 및 파일 존재 여부 확인
URLS_FILE=$1

if [ -z "$URLS_FILE" ]; then
    echo "❌ 사용법: ./get_posts.sh <URL_목록_파일_경로>"
    echo "예시: ./get_posts.sh list/urls.txt"
    exit 1
fi

if [ ! -f "$URLS_FILE" ]; then
    echo "❌ 파일을 찾을 수 없습니다: $URLS_FILE"
    exit 1
fi

echo "🚀 [시작] $URLS_FILE 기반 채용 공고 추출 및 백업 자동화 파이프라인 가동"

# 📂 'recent' 및 'html/markdown' 폴더 자동 생성 (초기화는 make clean 시점에 실행)
mkdir -p data/jobs/recent/markdown data/jobs/recent/html data/jobs/markdown data/jobs/html

# 📝 cache.list 경로 정의 및 갱신
CACHE_LIST="data/jobs/lists/cache.list"
echo "🔍 기존 수집된 HTML 기반으로 cache.list 갱신 중..."
# 기존 수집된 모든 *.html 파일의 JOB_ID를 수집하여 cache.list에 적재 (중복 제거)
find data/jobs/html -type f -name "*.html" 2>/dev/null | xargs -I {} basename {} .html | sort -u > "$CACHE_LIST"
echo "✅ 총 $(wc -l < "$CACHE_LIST" 2>/dev/null || echo 0) 개의 기존 수집본을 cache.list에 등록했습니다."

# 📝 urls.txt에서 이미 수집된 JOB_ID가 포함된 URL을 미리 필터링
TEMP_URLS_FILE=$(mktemp)
if [ -s "$CACHE_LIST" ]; then
    awk -F'/' '
    FNR==NR { cache[$1]=1; next }
    {
        url = $0
        if (url ~ /^#/ || url == "") {
            print url
            next
        }
        job_id = ""
        if (url ~ /\/view\/[0-9]+/) {
            match(url, /\/view\/([0-9]+)/, arr)
            job_id = arr[1]
        } else {
            n = split(url, parts, "/")
            if (n >= 2) {
                job_id = parts[n-1]
                if (job_id == "") job_id = parts[n]
            }
        }
        if (!(job_id in cache)) {
            print url
        }
    }
    ' "$CACHE_LIST" "$URLS_FILE" > "$TEMP_URLS_FILE"
else
    cp "$URLS_FILE" "$TEMP_URLS_FILE"
fi

# 필터링 전후의 개수 차이 계산하여 안내
ORIG_COUNT=$(grep -v '^#' "$URLS_FILE" | grep -v '^$' | wc -l)
FILTERED_COUNT=$(grep -v '^#' "$TEMP_URLS_FILE" | grep -v '^$' | wc -l)
SKIP_COUNT=$((ORIG_COUNT - FILTERED_COUNT))
echo "📊 전체 대상: ${ORIG_COUNT}건 | 스킵(이미 완료): ${SKIP_COUNT}건 | 신규 처리 대상: ${FILTERED_COUNT}건"

# 임시 마크다운 파일명 정의 (data/jobs/ 폴더 하위에 임시 생성)
TEMP_RAW_MD="data/jobs/temp_job_raw_$$.md"

# 2. 파라미터로 전달된 파일의 각 줄(URL)을 읽어서 처리
while IFS= read -r url || [ -n "$url" ]; do
    [[ -z "$url" || "$url" =~ ^# ]] && continue
    [[ ! "$url" =~ ^https?:// ]] && continue

    # 🆔 URL에서 공고 ID 추출
    if [[ "$url" =~ /view/([0-9]+) ]]; then
        JOB_ID="${BASH_REMATCH[1]}"
    else
        JOB_ID=$(echo "$url" | awk -F'/' '{print $(NF-1)}')
    fi

    echo -e "\n=================================================="
    echo "🌐 대상 ID: $JOB_ID | URL: $url"
    echo "=================================================="

    # 🔍 기존 HTML 파일 검색 (모든 하위 구조 탐색) - 사전 필터링 후라 거의 실행되지 않음
    SAVED_HTML=$(find data/jobs/html -type f -name "${JOB_ID}.html" 2>/dev/null | head -n 1)

    IS_NEW=false
    if [ -n "$SAVED_HTML" ] && [ -f "$SAVED_HTML" ] && [ -s "$SAVED_HTML" ]; then
        echo "⏭️  [스킵] 기존 HTML 파일(${SAVED_HTML})이 존재하므로 다운로드를 건너뜁니다."
        HTML_TO_PROCESS="$SAVED_HTML"
    else
        # HTML 파일이 없을 때만 임시 경로에 새롭게 다운로드
        TEMP_HTML="data/jobs/temp_${JOB_ID}.html"
        echo "📥 [1/4] 웹페이지 새 데이터 덤프 진행 중 (get_html.js)..."
        node src/get_html.js "$url" "$TEMP_HTML"

        if [ ! -s "$TEMP_HTML" ]; then
            echo "❌ HTML을 정상적으로 가져오지 못했습니다. 다음 URL로 넘어갑니다."
            rm -f "$TEMP_HTML"
            continue
        fi
        HTML_TO_PROCESS="$TEMP_HTML"
        IS_NEW=true
    fi

    # 정해진 다음 스텝들을 순차적으로 진행합니다.
    echo "🔍 [2/4] 핵심 정보 추출 및 마크다운 변환 중 (html2md.js)..."
    node src/html2md.js "$HTML_TO_PROCESS" "$TEMP_RAW_MD"

    # 포스팅 날짜 추출 및 날짜 포맷 변환 (YYYY-MM-DD)
    RAW_DATE=$(grep -oP '\*\*(?:포스팅 날짜|Posted Date)(?: \([^)]+\))?:\*\* \K([0-9]{4}년 [0-9]{2}월 [0-9]{2}일|[0-9]{4}-[0-9]{2}-[0-9]{2})' "$TEMP_RAW_MD")
    if [[ "$RAW_DATE" =~ "년" ]]; then
        POST_DATE=$(echo "$RAW_DATE" | sed 's/년 /-/g; s/월 /-/g; s/일//g')
    else
        POST_DATE="$RAW_DATE"
    fi
    if [ -z "$POST_DATE" ]; then
        POST_DATE=$(date +%Y-%m-%d)
    fi

    # 근무 위치 추출 및 안전 폴더명 처리
    LOCATION=$(grep -oP '\*\*(?:근무 위치|Location)(?: \([^)]+\))?:\*\* \K.+' "$TEMP_RAW_MD" | sed 's/[\/\\:\*\?"<>\|]/ /g' | xargs)
    if [ -z "$LOCATION" ] || [ "$LOCATION" = "정보 없음" ] || [ "$LOCATION" = "No info" ]; then
        LOCATION="unknown-location"
    fi

    # 🗺️ 근무지 매핑 및 표준화 규칙 적용
    if [[ "$LOCATION" =~ [가-힣] || "$LOCATION" =~ "South Korea" || "$LOCATION" =~ "Seoul" || "$LOCATION" =~ "Korea" || "$LOCATION" =~ "서울" || "$LOCATION" =~ "대한민국" || "$LOCATION" =~ "Pangyo" || "$LOCATION" =~ "Bundang" || "$LOCATION" =~ "Gyeonggi" ]]; then
        LOCATION="Korea"
    elif [[ "$LOCATION" =~ "Abu Dhabi" || "$LOCATION" =~ "Dubai" || "$LOCATION" =~ "United Arab Emirates" || "$LOCATION" =~ "아부다비" || "$LOCATION" =~ "두바이" || "$LOCATION" =~ "아랍에미리트" || "$LOCATION" =~ "أبو ظبي" || "$LOCATION" =~ "دبي" || "$LOCATION" =~ "الإمارات" || "$LOCATION" =~ "الشارقة" || "$LOCATION" =~ "الخيمة" ]]; then
        LOCATION="Abu Dhabi"
    elif [[ "$LOCATION" =~ "Singapore" || "$LOCATION" =~ "싱가포르" ]]; then
        LOCATION="Singapore"
    elif [[ "$LOCATION" =~ "United Kingdom" || "$LOCATION" =~ "London" || "$LOCATION" =~ "영국" ]]; then
        LOCATION="United Kingdom"
    elif [[ "$LOCATION" =~ "Canada" || "$LOCATION" =~ "Toronto" || "$LOCATION" =~ "캐나다" ]]; then
        LOCATION="Canada"
    elif [[ "$LOCATION" =~ "Ireland" || "$LOCATION" =~ "Dublin" || "$LOCATION" =~ "아일랜드" ]]; then
        LOCATION="Ireland"
    elif [[ "$LOCATION" =~ "Germany" || "$LOCATION" =~ "Marburg" || "$LOCATION" =~ "독일" ]]; then
        LOCATION="Germany"
    elif [[ "$LOCATION" =~ "Saudi Arabia" || "$LOCATION" =~ "Riyadh" || "$LOCATION" =~ "사우디" ]]; then
        LOCATION="Saudi Arabia"
    elif [[ "$LOCATION" =~ "Japan" || "$LOCATION" =~ "Tokyo" || "$LOCATION" =~ "Shibuya" || "$LOCATION" =~ "일본" ]]; then
        LOCATION="Japan"
    fi

    # 위치 및 날짜 기준 저장 폴더 정의 (inbox 폴더의 하위 경로로 완벽 적재)
    TARGET_DIR="data/jobs/markdown/${LOCATION}/${POST_DATE}"
    HTML_DIR="data/jobs/html/${LOCATION}/${POST_DATE}"
    mkdir -p "$TARGET_DIR" "$HTML_DIR"

    # HTML 파일 이동 및 경로 정렬 (임시 파일이거나 다른 날짜/경로에 있으면 올바른 위치/날짜 폴더로 이동)
    if [ "$HTML_TO_PROCESS" = "data/jobs/temp_${JOB_ID}.html" ] || [ "$HTML_TO_PROCESS" != "${HTML_DIR}/${JOB_ID}.html" ]; then
        mv "$HTML_TO_PROCESS" "${HTML_DIR}/${JOB_ID}.html"
        SAVED_HTML="${HTML_DIR}/${JOB_ID}.html"
        echo "💾 [완료] 원본 HTML 백업 완료 -> $SAVED_HTML"
        # 🆕 cache.list 파일에 실시간 갱신 (동일 ID 중복 처리 대비)
        echo "$JOB_ID" >> "$CACHE_LIST"
    fi

    # 이전에 전달해 드린 HTML 특수문자(&amp; -> &) 디코딩이 포함된 스크립트 호출
    FILE_INFO=$(node src/get_filename.js "$TEMP_RAW_MD")

    FINAL_PATH="${TARGET_DIR}/${FILE_INFO}.md"
    echo "📂 저장 경로 정의됨: $FINAL_PATH"

    # 오픈소스 Prettier를 내장하여 서식을 깨뜨리지 않는 새로운 prettify.js 실행
    echo "🧹 [3/4] 오픈소스 Prettier 기반 마크다운 정제 중 (prettify.js)..."
    node src/prettify.js "$TEMP_RAW_MD" "$FINAL_PATH"

    # 🆕 신규 수집 공고인 경우 'recent/' 폴더에 각각 추가 복사본 보관
    if [ "$IS_NEW" = true ]; then
        cp "${HTML_DIR}/${JOB_ID}.html" "data/jobs/recent/html/${JOB_ID}.html" 2>/dev/null || true
        cp "$FINAL_PATH" "data/jobs/recent/markdown/${FILE_INFO}.md" 2>/dev/null || true
        echo "🆕 [신규 추가] 새 공고 복사본을 data/jobs/recent/ 하위에 저장 완료!"
    fi

    echo "✨ [4/4] 완료! 최종 마크다운 파일이 생성되었습니다."

done < "$TEMP_URLS_FILE"

# 3. 작업용 임시 파일 정리
rm -f "$TEMP_RAW_MD" "$TEMP_URLS_FILE"

# 4. 작업 중 비어버린 임시/이동된 상위 폴더들 자동 정리 (data/jobs 폴더 자체는 보존)
find data/jobs -mindepth 1 -type d -empty -delete 2>/dev/null || true

echo -e "\n🎉 [종료] 일괄 처리 완료! 결과는 './data/jobs/html/[근무위치]/[포스팅날짜]/' 및 './data/jobs/markdown/[근무위치]/[포스팅날짜]/' 폴더를 확인하세요."