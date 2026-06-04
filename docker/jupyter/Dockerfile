FROM jupyter/minimal-notebook:latest

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
