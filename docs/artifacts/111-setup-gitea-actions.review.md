# 🔍 검토서: Gitea Actions 추가 설정 (111-setup-gitea-actions.review.md)

이 문서는 Gitea Actions 활성화를 위한 설정 변경 사항이 올바르게 반영되었는지 검증한 내용을 기록합니다.

---

## 1. 변경 전/후 비교

### A. Gitea 환경 설정
* **변경 전**: `GITEA__actions__ENABLED` 환경 변수 없음 (기본값 의존 혹은 비활성)
* **변경 후**: `GITEA__actions__ENABLED=true` 추가 설정 완료. Gitea 인스턴스 내 Actions 기능 명시적 활성화.

### B. Runner 서비스 추가
* **변경 전**: Actions 작업을 실행하기 위한 runner 없음.
* **변경 후**: Gitea 컨테이너 내부망 `http://gitea:3000`을 바라보는 `act_runner` 서비스 정의 추가. `/var/run/docker.sock` 마운트를 통해 도커 컨테이너 실행 권한 확보.

---

## 2. 잠재적 리스크 및 대응 방안
* **권한 문제**: 호스트 환경의 docker.sock 소유 그룹(docker/root 등)에 따라 `act_runner`가 docker 소켓에 접근하지 못하는 오류가 발생할 수 있습니다.
  - *대응*: `act_runner` 이미지의 기본 계정이 root 권한을 갖는 `latest` 버전을 채택하여 문제를 최소화하였습니다.
* **토큰 부재**: 최초 실행 시 `/data/token` 파일에 유효한 등록 토큰이 없으면 `act_runner`가 실행 도중 실패를 반복할 수 있습니다.
  - *대응*: 사용자가 토큰을 쉽게 생성하여 기록할 수 있도록 결과보고서에 등록 가이드를 명시합니다.
