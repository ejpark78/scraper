# ==============================================================================
# 🐳 Module: Dockerfile (viewer-fe)
# Description: Development Vite Dev Server container for viewer frontend with HMR
# Last Updated: 2026-06-16
# ==============================================================================

FROM node:22-bookworm

WORKDIR /app

# Install frontend dependencies
COPY apps/viewer/frontend/package*.json ./apps/viewer/frontend/
RUN npm install --prefix apps/viewer/frontend && npm cache clean --force

# Copy frontend source code
COPY apps/viewer/frontend ./apps/viewer/frontend

# Expose Vite development port
EXPOSE 5173

# Run Vite dev server bound to all interfaces
CMD ["npm", "--prefix", "apps/viewer/frontend", "run", "dev", "--", "--host", "0.0.0.0"]
