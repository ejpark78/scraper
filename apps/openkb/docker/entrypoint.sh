#!/bin/sh
set -e

# 설정 저장소 디렉토리들이 존재하지 않을 경우 안전하게 생성
mkdir -p /data/openkb/.config/openkb
mkdir -p /data/openkb/.openkb

# 이미지 내의 설정 파일들을 런타임에 호스트 볼륨 설정 경로로 복사
cp /app/docker/global.yaml /data/openkb/.config/openkb/global.yaml
cp /app/docker/config.yaml /data/openkb/.openkb/config.yaml

# 본래의 진입 명령어 실행
exec "$@"
