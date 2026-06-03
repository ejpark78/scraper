FROM mcr.microsoft.com/playwright:v1.45.0-jammy

# 한글 폰트 미설치 시 덤프 파일 내 한글 깨짐 현상 예방
RUN apt-get update && apt-get install -y \
    fonts-nanum \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# npm 의존성 캐시 활용 빌드
COPY package*.json ./
RUN npm ci

# 소스 코드 및 빌드 설정 복사
COPY . .

# 데이터 및 설정 보존 디렉토리 확보
RUN mkdir -p data config

# 컨테이너 실행 기본 타겟 (Makefile로 제어하므로 대기 상태)
CMD ["tail", "-f", "/dev/null"]
