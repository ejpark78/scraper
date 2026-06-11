# ==============================================================================
# 🐳 Module: Dockerfile (cronicle)
# Description: Docker image build specification
# Last Updated: 2026-06-11
# ==============================================================================

FROM bluet/cronicle-docker:0.9.99

ARG BUILD_DATE
ARG VCS_REF

LABEL org.opencontainers.image.title="Cronicle Scheduler"
LABEL org.opencontainers.image.description="Cron-based job scheduler with web UI for managing scraper tasks"
LABEL org.opencontainers.image.source="https://github.com/ejpark/linkedin"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.licenses="MIT"

# Docker CLI와 Docker Compose CLI 플러그인을 설치하여 컨테이너 내부에서 호스트의 Docker 데몬을 제어할 수 있도록 설정합니다.
RUN apk add --no-cache docker-cli docker-cli-compose

# 기본 설정 스키마 백업 파일을 임포트할 수 있도록 준비해 둡니다.
COPY default.json /opt/cronicle/default.json

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3012/', (r) => process.exit(r.statusCode < 400 ? 0 : 1)).on('error', () => process.exit(1))"
