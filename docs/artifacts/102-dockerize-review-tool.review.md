# 102-dockerize-review-tool.review.md

`npm run review`를 `docker compose` 내부 환경에서 안전하게 위임(Proxying) 구동하고, `AGENTS.md` 지침을 개정한 내역에 대한 리뷰 보고서입니다.

---

## 🎯 1. 변경 전/후 대비 (Before/After Comparison)
* **변경 전**:
  - `npm run review`가 오직 로컬 호스트 컴퓨터의 `ts-node`와 Node 환경에 의존하여 실행되었습니다.
  - `AGENTS.md` 규칙 7번에 AI 코드 리뷰 스크립트 실행 격리 기준이 누락되어 있었습니다.
  - 컨테이너에 `GEMINI_API_KEY` 환경 변수가 누락되어 컨테이너가 켜져 있어도 AI 도구를 사용하기 어려웠습니다.
* **변경 후**:
  - `scripts/agents/review-changes.sh`가 로컬 및 컨테이너 내부 환경을 자가 판별합니다.
  - 실행 중인 Docker `worker` 컨테이너가 감지될 경우, 로컬 패치를 `docker cp`하여 컨테이너 환경으로 위임 처리하고 내부 `ts-node`를 통해 격리 실행합니다.
  - `AGENTS.md`에 정적 린트/검사뿐만 아니라 AI 코드 리뷰 실행 시에도 Docker 컨테이너 위임 구동을 원칙으로 삼도록 문구 개정을 완료했습니다.
  - `apps/crawler` 및 `apps/viewer` compose 파일에 `GEMINI_API_KEY` 매핑을 제공합니다.

---

## 🔍 2. 자가 검증 결과
* **코드 무결성**: `compose.yml` 및 `scripts/agents/review-changes.sh` 분기 실행문 정합성 확인 완료.
* **규칙 준수**: `AGENTS.md` 내용 보강 검토 결과, "Docker 중심 테스트 및 실행" 원칙에 완벽히 정렬됨.
