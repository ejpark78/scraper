# ==============================================================================
# 🐳 Module: Dockerfile (scraper)
# Description: Docker image build specification for details scraper worker
# Last Updated: 2026-06-11
# ==============================================================================

FROM mcr.microsoft.com/playwright:v1.60.0-jammy

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

ARG BUILD_DATE
ARG VCS_REF

LABEL org.opencontainers.image.title="Scraper Worker"
LABEL org.opencontainers.image.description="Playwright-based background scraper worker for details queue"
LABEL org.opencontainers.image.source="https://github.com/ejpark/scraper"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.licenses="MIT"

# Install Korean fonts and build tools
RUN apt-get update && apt-get install -y \
    fonts-nanum \
    make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies using cache layers
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source files
COPY . .

CMD ["npm", "run", "worker:scraper"]
