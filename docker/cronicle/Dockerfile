FROM bluet/cronicle-docker:0.9.99

# Docker CLI와 Docker Compose CLI 플러그인을 설치하여 컨테이너 내부에서 호스트의 Docker 데몬을 제어할 수 있도록 설정합니다.
RUN apk add --no-cache docker-cli docker-cli-compose

# 기본 설정 스키마 백업 파일을 임포트할 수 있도록 준비해 둡니다.
COPY default.json /opt/cronicle/default.json
