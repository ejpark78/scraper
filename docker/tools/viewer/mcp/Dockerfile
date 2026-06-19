# ==============================================================================
# 🐳 Module: Dockerfile (viewer-mcp)
# Description: Docker image build specification for MCP server
# Last Updated: 2026-06-16
# ==============================================================================

FROM node:22-bookworm

ARG BUILD_DATE
ARG VCS_REF

LABEL org.opencontainers.image.title="LinkedIn Viewer MCP"
LABEL org.opencontainers.image.description="MCP tool server for LinkedIn Clipper"
LABEL org.opencontainers.image.source="https://github.com/ejpark/linkedin"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install root dependencies using cache layers
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Install frontend dependencies using cache layers
COPY apps/viewer/frontend/package*.json ./apps/viewer/frontend/
RUN npm install --prefix apps/viewer/frontend && npm cache clean --force

# Copy source files
COPY . .

# Generate static sites config JSON
RUN TS_NODE_PROJECT=tsconfig.json npx ts-node -r tsconfig-paths/register --project tsconfig.json apps/crawler/src/scripts/generate-sites-config.ts

# Build the frontend assets
RUN npm --prefix apps/viewer/frontend run build

CMD ["tail", "-f", "/dev/null"]
