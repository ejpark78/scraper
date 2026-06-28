# 📝 계획서: Gitea Actions 추가 설정 (111-setup-gitea-actions.plan.md)

이 문서는 Gitea에 로컬 CI/CD 파이프라인 수행을 위한 Gitea Actions 및 `act_runner` 컨테이너 설정을 추가하는 계획을 정의합니다.

---

## 1. 개요 & 목적
* 현재 `docker/tools/gitea/compose.yml`에는 Gitea 서비스 단독 구성만 존재합니다.
* 워크플로우 자동화 및 CI/CD 인프라 구축을 위해 Gitea Actions 기능을 활성화하고, 액션을 실행할 `gitea/act_runner`를 멀티 컨테이너 구성으로 추가합니다.

---

## 2. 변경 계획 및 설계

### A. Gitea 서비스 설정 변경 ([compose.yml](../../docker/tools/gitea/compose.yml))
* Gitea 환경 변수(`environment`)에 Actions 활성화 옵션을 추가합니다.
  ```yaml
  - GITEA__actions__ENABLED=true
  ```

### B. `act_runner` 서비스 추가 ([compose.yml](../../docker/tools/gitea/compose.yml))
* Gitea와 같은 네트워크망에서 동작하며 Docker 데몬 소켓을 공유하여 컨테이너 기반 액션 작업이 가능한 `act_runner` 컨테이너를 추가합니다.
* 내부 Gitea 컨테이너 주소(`http://gitea:3000`)를 연동 주소로 활용합니다.
* 볼륨 마운트 구조:
  - Docker 소켓: `/var/run/docker.sock`
  - Runner 데이터 저장소: `${HOST_PROJECT_PATH:-.}/data/.services/gitea/act_runner:/data`

---

## 3. 상세 설정 (Draft)

```yaml
  act_runner:
    image: gitea/act_runner:latest-rootless
    profiles:
      - tools
    depends_on:
      gitea:
        condition: service_healthy
    security_opt:
      - no-new-privileges:true
    user: "1000:1000" # rootless 환경 매핑 또는 환경에 맞는 권한 설정
    environment:
      - GITEA_INSTANCE_URL=http://gitea:3000
      - GITEA_RUNNER_REGISTRATION_TOKEN_FILE=/data/token
      - GITEA_RUNNER_NAME=local-runner
      - GITEA_RUNNER_LABELS=ubuntu-latest:docker://node:18-bullseye,ubuntu-22.04:docker://node:18-bullseye
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ${HOST_PROJECT_PATH:-.}/data/.services/gitea/act_runner:/data
    restart: unless-stopped
```

* **Runner 등록 절차**:
  1. Gitea 웹 UI에서 관리자 권한으로 `Site Administration -> Actions -> Runners` 메뉴로 이동하여 Registration Token을 획득합니다.
  2. 획득한 토큰을 `data/.services/gitea/act_runner/token` 파일에 기록합니다.
  3. `docker compose`를 통해 `act_runner` 서비스를 재시작하여 Gitea 서버에 자동 등록을 진행합니다.

---

## 4. 검증 및 수동 실행 작업 안내
* Gitea 컨테이너가 켜진 상태에서 관리자 화면을 통해 토큰을 발급받아야 하므로, 데이터 변경 및 환경 구동을 수동으로 유도하기 위해 사용자에게 명령어를 제시하고 진행합니다.
