FROM jupyter/minimal-notebook:latest

ARG BUILD_DATE
ARG VCS_REF

LABEL org.opencontainers.image.title="Jupyter Data Analysis"
LABEL org.opencontainers.image.description="Jupyter notebook environment for market data analysis and NER extraction"
LABEL org.opencontainers.image.source="https://github.com/ejpark/linkedin"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.licenses="MIT"

USER root

# 필요한 OS 의존성이 있다면 설치 (예: curl, git 등)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

USER jovyan

# 데이터 분석을 위한 필수 Python 패키지들을 빌드 타임에 선점 설치
RUN pip install --no-cache-dir \
    pymongo \
    pandas \
    numpy \
    matplotlib \
    seaborn \
    scikit-learn

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8888/api || exit 1
