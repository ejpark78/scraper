# 102-dockerize-review-tool.plan.md

`npm run review`를 호스트 환경에 의존하지 않고 `docker compose` 환경 내에서 완전히 실행할 수 있도록 통합하고, `AGENTS.md` 파일에 로컬 스크립트 실행 제약을 명문화하여 보안과 환경 고립도를 극대화합니다.

---

## 🎯 1. 목적 (Objectives)
* **호스트 의존성 최소화**: `ts-node` 등 전역 node 개발 의존성이나 API Key 주입 경로가 호스트에 얽매이지 않도록, Docker 컨테이너 내에서 `npm run review`를 격리 실행합니다.
* **보안 및 환경 격리**: `GEMINI_API_KEY`를 로컬 호스트 터미널에서 강제 노출시키지 않고 `docker compose` 또는 `.env` 연계를 통해 안전하게 전달할 수 있도록 구성합니다.
* **AGENTS.md 보완**: `AGENTS.md`에 "로컬 코드 검증 및 코드 리뷰 스크립트는 Docker 컨테이너 내에서 안전하게 격리되어 실행되어야 함" 규칙을 명시적으로 추가합니다.

---

## 🏗️ 2. 설계 및 아키텍처 (Architecture & Design)

### A. Docker Compose 통합
* `apps/crawler/docker/worker/compose.yml` (또는 메인 `compose.yml`)에 `worker` 서비스가 정의되어 있으며, 이 컨테이너는 볼륨 마운트로 `/app` 전체가 마운트되고 Node.js 개발 의존성을 포함하고 있습니다.
* `npm run review`를 Docker 내에서 돌리기 위해 다음 CLI 호출 패턴을 적용합니다:
  ```bash
  docker compose exec -T worker npm run review
  ```
  또는 `compose.yml` 내에 `GEMINI_API_KEY` 환경변수가 전달되도록 `worker` 서비스 환경 변수 설정을 조율합니다.

### B. scripts/agents/review-changes.sh 개선
* 셸 스크립트가 실행될 때 호스트인지 컨테이너인지 감지합니다.
* 만약 호스트에서 `npm run review`를 직접 실행했고 Docker 컨테이너가 켜져 있다면, 컨테이너 내에서 실행하도록 위임(Proxying)할 수 있게 처리합니다. (기본적으로 Docker 내부망 진입을 보장하도록 함.)

---

## 📝 3. 작업 상세 범위 (Implementation Tasks)
* **`apps/crawler/docker/worker/compose.yml` 수정**:
  - `worker` 서비스에 `GEMINI_API_KEY=${GEMINI_API_KEY:-}` 환경 변수를 추가하여, 호스트의 API Key가 컨테이너 내부로 유연하게 전달되도록 매핑합니다.
* **`scripts/agents/review-changes.sh` 수정**:
  - 스크립트 내부에서 Docker가 켜져 있는지와 호스트인지 여부를 감지합니다.
  - 호스트에서 실행 시, `docker compose exec -e GEMINI_API_KEY worker npm run review` 형태로 컨테이너 내부로 위임 실행할 수 있게 분기를 만듭니다.
* **`AGENTS.md` 수정**:
  - `Docker 중심 테스트 및 실행` 제약 사항에 "정적 및 AI 리뷰 검증도 Docker 내부에서 실행함을 원칙으로 함" 지침을 추가합니다.

---

## 🔍 4. 자가 검증 방법 (Verification Steps)
1. **Docker 컨테이너 구동**: `docker compose up -d`로 인프라가 켜져 있는지 확인.
2. **리뷰 실행**: 호스트 터미널에서 `npm run review` 실행 시, 컨테이너 내부의 `ai-reviewer.ts`가 구동되어 응답을 리턴하는지 검증합니다.
3. **AGENTS.md 정합성 점검**: 에이전트 핵심 행동 제약 사항에 룰이 바르게 통합되었는지 검사합니다.
