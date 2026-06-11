# ==============================================================================
# 🐳 Module: Dockerfile (viewer)
# Description: Docker image build specification
# Last Updated: 2026-06-11
# ==============================================================================

FROM node:22-bookworm

ARG BUILD_DATE
ARG VCS_REF

LABEL org.opencontainers.image.title="LinkedIn Viewer"
LABEL org.opencontainers.image.description="Document explorer & MCP hybrid server for LinkedIn Clipper"
LABEL org.opencontainers.image.source="https://github.com/ejpark/linkedin"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["tail", "-f", "/dev/null"]
