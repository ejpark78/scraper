# ==============================================================================
# 🧠 OpenKB Dockerfile (Stable Python 3.13)
# ==============================================================================
FROM python:3.13-slim

# ghcr.io/astral-sh/uv 이미지에서 uv 바이너리를 복사하여 시스템에 설치
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_CACHE_DIR=/tmp/uv-cache
ENV UV_NO_VENV=1
ENV UV_FROZEN=1
ENV UV_PROJECT_ENVIRONMENT=/usr/local
ENV UV_NO_SYNC=1

WORKDIR /app

# 의존성 복사 및 패키지 인스톨
COPY pyproject.toml uv.lock /app/
RUN uv pip install --system --no-cache --prerelease=allow -r pyproject.toml

# 스크립트 복사
COPY . /app/

# 기본 작업 디렉토리 지정 (기록할 볼륨이 마운트되는 경로)
WORKDIR /data/openkb

# 실행 진입점 정의 (기본값)
ENTRYPOINT ["openkb"]
