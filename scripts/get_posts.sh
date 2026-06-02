#!/usr/bin/env bash

# ⚙️ LinkedIn 채용 공고 일괄 수집 및 가공 파이프라인 셸 인터페이스
# 실제 핵심 오케스트레이션 및 가공 동작은 Node.js 기반 초고속 엔진(src/get_posts.js)으로 100% 마이그레이션되었습니다.

node src/get_posts.js "$@"