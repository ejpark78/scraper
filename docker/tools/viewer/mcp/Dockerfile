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
COPY src/viewer/frontend/package*.json ./src/viewer/frontend/
RUN npm install --prefix src/viewer/frontend && npm cache clean --force

# Copy source files
COPY . .

# Generate static sites config JSON
RUN npx ts-node src/scripts/generate-sites-config.ts

# Build the frontend assets
RUN npm --prefix src/viewer/frontend run build

CMD ["tail", "-f", "/dev/null"]
