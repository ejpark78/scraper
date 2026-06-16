# ==============================================================================
# 🐳 Module: Dockerfile (viewer-fe)
# Description: Development Vite Dev Server container for viewer frontend with HMR
# Last Updated: 2026-06-16
# ==============================================================================

FROM node:22-bookworm

WORKDIR /app

# Install frontend dependencies
COPY src/viewer/frontend/package*.json ./src/viewer/frontend/
RUN npm install --prefix src/viewer/frontend && npm cache clean --force

# Expose Vite development port
EXPOSE 5173

# Run Vite dev server bound to all interfaces
CMD ["npm", "--prefix", "src/viewer/frontend", "run", "dev", "--", "--host", "0.0.0.0"]
