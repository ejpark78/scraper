# ==============================================================================
# 🧠 OpenKB Dockerfile (Stable Python 3.13)
# ==============================================================================
FROM python:3.13-slim

# ghcr.io/astral-sh/uv 이미지에서 uv 바이너리를 복사하여 시스템에 설치
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /data/openkb

# uv를 사용하여 초고속 병렬 패키지 인스톨 수행 (--prerelease=allow 포함)
RUN uv pip install --system --no-cache --prerelease=allow openkb==0.3.0

# 실행 진입점 정의
ENTRYPOINT ["openkb"]
