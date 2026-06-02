#!/usr/bin/env bash

# 📂 HTML 파싱 및 마크다운 변환 유틸리티 스크립트 (듀얼 모드 지원)
# 모드 1 (단일 변환): ./scripts/html2md.sh <입력_HTML> <출력_MD>
# 모드 2 (일괄 동기화): ./scripts/html2md.sh (인자 없음) -> html/inbox/ 내 HTML 파일 기준 posts/inbox/ 에 MD가 없으면 전체 자동 변환

# 1. 인자가 2개 들어온 경우 (단일 파일 독립 변환)
if [ -n "$1" ] && [ -n "$2" ]; then
    INPUT_HTML=$1
    OUTPUT_MD=$2

    if [ ! -f "$INPUT_HTML" ]; then
        echo "❌ 에러: 입력 HTML 파일을 찾을 수 없습니다: $INPUT_HTML"
        exit 1
    fi

    echo "🔄 단일 HTML 파일 마크다운 변환 중..."
    node src/html2md.js "$INPUT_HTML" "$OUTPUT_MD"
    exit 0
fi

# 2. 인자가 없는 경우 (data/jobs/html/ 폴더와 data/jobs/markdown/ 폴더 간 오프라인 일치성 동기화)
echo "🔄 [동기화 검사 시작] data/jobs/html 내의 HTML 캐시와 data/jobs/markdown 내 마크다운 일치성을 검사합니다."

TEMP_RAW_MD="data/jobs/temp_job_raw_$$.md"
mkdir -p data/jobs/html data/jobs/markdown

# data/jobs/html 하위의 모든 html 파일들을 찾아 순회
find data/jobs/html -type f -name "*.html" | while read -r html_file; do
    # 임시 마크다운 생성하여 메타 정보 로드
    node src/html2md.js "$html_file" "$TEMP_RAW_MD" 2>/dev/null

    if [ ! -f "$TEMP_RAW_MD" ]; then
        echo "⚠️  [실패] HTML 구조 분석 실패 (스킵): $html_file"
        continue
    fi

    # 포스팅 날짜 추출 및 포맷팅 (YYYY-MM-DD)
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

    # 근무지 지리 매핑 및 표준화 규칙 적용
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

    # 최종 md 파일의 대상 디렉토리 및 경로 계산
    TARGET_DIR="data/jobs/markdown/${LOCATION}/${POST_DATE}"
    FILE_INFO=$(node src/get_filename.js "$TEMP_RAW_MD" 2>/dev/null)
    
    if [ -z "$FILE_INFO" ]; then
        echo "⚠️  [실패] 파일명 생성 실패 (스킵): $html_file"
        rm -f "$TEMP_RAW_MD"
        continue
    fi
    
    FINAL_PATH="${TARGET_DIR}/${FILE_INFO}.md"

    # posts 하위에 마크다운 파일이 존재하지 않거나 크기가 0인 경우에만 오프라인 변환 수행
    if [ ! -f "$FINAL_PATH" ] || [ ! -s "$FINAL_PATH" ]; then
        echo "🆕 [누락 발견] 마크다운 복원 및 변환 중 -> ${FILE_INFO}.md"
        mkdir -p "$TARGET_DIR"
        node src/prettify.js "$TEMP_RAW_MD" "$FINAL_PATH"
        echo "💾 [복원 완료] -> $FINAL_PATH"
    fi

    # HTML 파일의 표준화 경로 계산 및 이동 (html 디렉토리 구조도 posts와 완전 동기화)
    CORRECT_HTML_DIR="data/jobs/html/${LOCATION}/${POST_DATE}"
    JOB_ID=$(basename "$html_file")
    CORRECT_HTML_PATH="${CORRECT_HTML_DIR}/${JOB_ID}"

    if [ "$html_file" != "$CORRECT_HTML_PATH" ]; then
        echo "🚚 [HTML 재배치] $html_file -> $CORRECT_HTML_PATH"
        mkdir -p "$CORRECT_HTML_DIR"
        mv "$html_file" "$CORRECT_HTML_PATH"
    fi

    # 임시 작업 파일 제거
    rm -f "$TEMP_RAW_MD"
done

# 작업 중 비어버린 하위 폴더들 자동 정리 (data/jobs 폴더 자체는 보존)
find data/jobs -mindepth 1 -type d -empty -delete 2>/dev/null || true

echo "✨ [동기화 완료] data/jobs/html/ 과 data/jobs/markdown/ 디렉토리 구조가 완벽하게 일치합니다."
