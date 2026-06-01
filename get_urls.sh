#!/usr/bin/env bash

# 1. list/*.html에서 href 추출 후 정밀 정제하여 list/urls.txt에 누적 저장
cat list/*.html \
    | tidy -indent -quiet --show-warnings no -wrap 0 | grep -oP 'href="\K[^"]+' \
    | grep /view/ | sort -u \
    | sed -E -e 's/\/?\?.*/\//' -e 's|^\/jobs|https://www.linkedin.com/jobs|' \
    | tee -a list/urls.txt
