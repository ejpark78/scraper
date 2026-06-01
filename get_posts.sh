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

# 📂 'new' 및 'inbox' 폴더 자동 생성 및 초기화
rm -rf posts/new html/new
mkdir -p posts/new html/new posts/inbox html/inbox

# 임시 마크다운 파일명 정의 (디렉토리 생성 순서와 무관하도록 루트에 정의)
TEMP_RAW_MD="temp_job_raw.md"

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

    # 🔍 기존 HTML 파일 검색 (모든 하위 구조 탐색)
    SAVED_HTML=$(find html -type f -name "${JOB_ID}.html" | head -n 1)

    IS_NEW=false
    if [ -n "$SAVED_HTML" ] && [ -f "$SAVED_HTML" ] && [ -s "$SAVED_HTML" ]; then
        echo "⏭️  [스킵] 기존 HTML 파일(${SAVED_HTML})이 존재하므로 다운로드를 건너뜁니다."
        HTML_TO_PROCESS="$SAVED_HTML"
    else
        # HTML 파일이 없을 때만 임시 경로에 새롭게 다운로드
        TEMP_HTML="html/temp_${JOB_ID}.html"
        echo "📥 [1/4] 웹페이지 새 데이터 덤프 진행 중 (get_html.js)..."
        node get_html.js "$url" "$TEMP_HTML"

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
    node html2md.js "$HTML_TO_PROCESS" "$TEMP_RAW_MD"

    # 포스팅 날짜 추출 및 날짜 포맷 변환 (YYYY-MM-DD)
    POST_DATE=$(grep -oP '\*\*포스팅 날짜 \(Posted Date\):\*\* \K[0-9]{4}년 [0-9]{2}월 [0-9]{2}일' "$TEMP_RAW_MD" | sed 's/년 /-/g; s/월 /-/g; s/일//g')
    if [ -z "$POST_DATE" ]; then
        POST_DATE=$(date +%Y-%m-%d)
    fi

    # 근무 위치 추출 및 안전 폴더명 처리
    LOCATION=$(grep -oP '\*\*근무 위치:\*\* \K.+' "$TEMP_RAW_MD" | sed 's/[\/\\:\*\?"<>\|]/ /g' | xargs)
    if [ -z "$LOCATION" ] || [ "$LOCATION" = "정보 없음" ]; then
        LOCATION="unknown-location"
    fi

    # 🗺️ 근무지 매핑 및 표준화 규칙 적용
    if [[ "$LOCATION" =~ "South Korea" || "$LOCATION" =~ "Seoul" || "$LOCATION" =~ "Korea" || "$LOCATION" =~ "서울" || "$LOCATION" =~ "대한민국" ]]; then
        LOCATION="Korea"
    elif [[ "$LOCATION" =~ "Abu Dhabi" || "$LOCATION" =~ "Dubai" || "$LOCATION" =~ "United Arab Emirates" || "$LOCATION" =~ "아부다비" || "$LOCATION" =~ "두바이" || "$LOCATION" =~ "아랍에미리트" ]]; then
        LOCATION="Abu Dhabi"
    elif [[ "$LOCATION" =~ "Singapore" || "$LOCATION" =~ "싱가포르" ]]; then
        LOCATION="Singapore"
    fi

    # 위치 및 날짜 기준 저장 폴더 정의 (inbox 폴더의 하위 경로로 완벽 적재)
    TARGET_DIR="posts/inbox/${LOCATION}/${POST_DATE}"
    HTML_DIR="html/inbox/${LOCATION}/${POST_DATE}"
    mkdir -p "$TARGET_DIR" "$HTML_DIR"

    # HTML 파일 이동 및 경로 정렬 (임시 파일이거나 다른 날짜/경로에 있으면 올바른 위치/날짜 폴더로 이동)
    if [ "$HTML_TO_PROCESS" = "html/temp_${JOB_ID}.html" ] || [ "$HTML_TO_PROCESS" != "${HTML_DIR}/${JOB_ID}.html" ]; then
        mv "$HTML_TO_PROCESS" "${HTML_DIR}/${JOB_ID}.html"
        SAVED_HTML="${HTML_DIR}/${JOB_ID}.html"
        echo "💾 [완료] 원본 HTML 백업 완료 -> $SAVED_HTML"
    fi

    # 이전에 전달해 드린 HTML 특수문자(&amp; -> &) 디코딩이 포함된 스크립트 호출
    FILE_INFO=$(node get_filename.js "$TEMP_RAW_MD")

    FINAL_PATH="${TARGET_DIR}/${FILE_INFO}.md"
    echo "📂 저장 경로 정의됨: $FINAL_PATH"

    # 오픈소스 Prettier를 내장하여 서식을 깨뜨리지 않는 새로운 prettify.js 실행
    echo "🧹 [3/4] 오픈소스 Prettier 기반 마크다운 정제 중 (prettify.js)..."
    node prettify.js "$TEMP_RAW_MD" "$FINAL_PATH"

    # 🆕 신규 수집 공고인 경우 'new/' 폴더에 각각 추가 복사본 보관
    if [ "$IS_NEW" = true ]; then
        cp "${HTML_DIR}/${JOB_ID}.html" "html/new/${JOB_ID}.html" 2>/dev/null || true
        cp "$FINAL_PATH" "posts/new/${FILE_INFO}.md" 2>/dev/null || true
        echo "🆕 [신규 추가] 새 공고 복사본을 posts/new/ 및 html/new/ 에 저장 완료!"
    fi

    echo "✨ [4/4] 완료! 최종 마크다운 파일이 생성되었습니다."

done < "$URLS_FILE"

# 3. 작업용 임시 마크다운 파일 정리
rm -f "$TEMP_RAW_MD"

# 4. 작업 중 비어버린 임시/이동된 상위 폴더들 자동 정리
find html posts -type d -empty -delete 2>/dev/null || true

echo -e "\n🎉 [종료] 일괄 처리 완료! 결과는 './html/inbox/[근무위치]/[포스팅날짜]/' 및 './posts/inbox/[근무위치]/[포스팅날짜]/' 폴더를 확인하세요."