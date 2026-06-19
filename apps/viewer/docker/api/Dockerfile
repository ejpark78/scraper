# ==============================================================================
# 🐳 Module: Dockerfile (viewer-api)
# Description: Docker image build specification for document explorer API server
# Last Updated: 2026-06-16
# ==============================================================================

FROM node:22-bookworm

ARG BUILD_DATE
ARG VCS_REF

LABEL org.opencontainers.image.title="Scraper Viewer API"
LABEL org.opencontainers.image.description="Document explorer API server for Scraper"
LABEL org.opencontainers.image.source="https://github.com/ejpark/scraper"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install root dependencies using cache layers
COPY package*.json ./
RUN npm install && npm cache clean --force

# Install frontend dependencies using cache layers
COPY src/frontend/package*.json ./src/frontend/
RUN npm install --prefix src/frontend && npm cache clean --force

# Copy source files
COPY . .

# Generate static sites config JSON (commented out as apps/crawler is out of context)
# RUN TS_NODE_PROJECT=tsconfig.json npx ts-node -r tsconfig-paths/register --project tsconfig.json apps/crawler/src/scripts/generate-sites-config.ts

# Build the frontend assets
RUN npm run build --prefix src/frontend

CMD ["npx", "ts-node", "src/api/server.ts"]
