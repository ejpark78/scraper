# 102-dockerize-review-tool.walkthrough.md

`npm run review`를 `docker compose` 내부 환경에서 구동하는 아키텍처 개선 및 `AGENTS.md` 제약사항 보강 결과를 요약한 보고서입니다.

---

## 🎯 1. 구현 기능 요약 (Features Summary)
* **Docker Proxying 실행 구현**:
  - `scripts/agents/review-changes.sh`에서 Docker 컨테이너 실행 여부를 동적으로 판별합니다.
  - 호스트 머신에 node 개발 의존 패키지가 없고 Docker `worker` 컨테이너가 켜져 있으면, 로컬 patch를 컨테이너 `/tmp/review_diff.patch`로 임시 복사(`docker cp`)한 후 컨테이너 내부에서 코드 리뷰 로직을 위임 실행합니다.
* **GEMINI_API_KEY 매핑 보완**:
  - `apps/crawler/docker/worker/compose.yml` 및 `apps/viewer/compose.yml` 파일의 컨테이너 환경설정에 `GEMINI_API_KEY`를 등록하여 호스트의 API 키가 안전하게 흐를 수 있게 처리하였습니다.
* **AGENTS.md 규칙 보완**:
  - `AGENTS.md` 제약 조건 7번에 "정적 검증(lint/type-check) 및 로컬 AI 코드 리뷰 도구(`npm run review`) 실행 시 호스트의 개발 의존성 없이 Docker 격리 실행을 원칙으로 한다"는 가이드를 보강하여, Zero-Dependency 아키텍처 방향성을 명시화했습니다.

---

## 🔍 2. 자가 검증 결과
* 호스트 및 컨테이너 위임 구동 시나리오 분기 코드가 논리적으로 정상 수립되었음을 확인했습니다.
* `AGENTS.md` 파일에 추가된 개정 본문이 템플릿과 정합하게 안착했음을 검증하였습니다.
