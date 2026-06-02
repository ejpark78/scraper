#!/usr/bin/env bash

# 📂 HTML 파싱 및 마크다운 변환/동기화 유틸리티 셸 인터페이스
# 실제 핵심 동작은 Node.js 기반 고성능 엔진(src/html2md.js)으로 이식되어 안정적이고 빠르게 실행됩니다.

node src/html2md.js "$@"
