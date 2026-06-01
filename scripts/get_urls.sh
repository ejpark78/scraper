#!/usr/bin/env bash

# 1. list/ 및 html/ 하위의 모든 *.html에서 href 추출 후 정밀 정제하여 list/urls.txt에 누적 저장
find data/jobs/lists/ data/jobs/html/ -type f -name "*.html" -exec cat {} + 2>/dev/null \
    | grep -oP 'href="\K[^"]+' \
    | grep /view/ | sort -u \
    | sed -E -e 's/\/?\?.*/\//' -e 's|^\/jobs|https://www.linkedin.com/jobs|' \
    | tee -a data/jobs/lists/urls.txt
