FROM node:20-alpine

WORKDIR /app

# package.json 복사 및 패키지 설치
COPY package*.json ./
RUN npm install

# 소스코드 복사
COPY tsconfig.json ./
COPY src/ ./src/

# TypeScript 빌드
RUN npm run build

# 컨테이너 실행 기본 명령어 (기본적으로 CLI 헬프 출력 혹은 대기)
CMD ["npm", "run", "start", "--", "--help"]
