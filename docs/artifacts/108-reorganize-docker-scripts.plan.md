# 📋 108-reorganize-docker-scripts.plan.md

이 계획서는 프로젝트 내 `scripts/` 디렉토리에 파편화되어 있던 스크립트 파일들을 논리적 역할에 맞춰 `docker/` 및 `.agents/scripts/` 디렉토리로 안전하게 통합하고 재배치하기 위한 작업 계획입니다.

---

## 🎯 작업 목표
1. **역할 분리**:
   - 도커 컨테이너 및 런타임 제어 관련 파일: `docker/` 폴더 하위로 이동.
   - 에이전트(AI) 전용 호스트 도구: `.agents/scripts/` 폴더 하위로 이동.
2. **호환성 보장**:
   - 루트 `Makefile` 및 이동된 `agents.mk` 내부의 상대 경로를 모두 갱신하여 `make agents-commit`, `make up-tools` 등 기존 명령어가 정상 동작하도록 보장.
3. **디렉토리 깔끔화**:
   - 기존의 혼란스러운 `scripts/` 루트 디렉토리를 완전히 정리 및 삭제.

---

## 📂 파일 이동 맵 (Reallocation Map)

| 기존 파일 경로 | 변경할 신규 경로 | 역할 및 성격 |
| :--- | :--- | :--- |
| `scripts/environments.mk` | `docker/environments.mk` | 도커 런타임에 주입될 공통 환경변수 정의 |
| `scripts/utils/docker.mk` | `docker/docker.mk` | 공통 도커 컴포즈 제어 명령어 |
| `scripts/utils/mongo.mk` | `docker/infra/mongodb/mongo.mk` | MongoDB 전용 제어 명령어 |
| `scripts/utils/meili.mk` | `docker/infra/meilisearch/meili.mk` | Meilisearch 전용 제어 명령어 |
| `scripts/utils/browser.mk` | `docker/browser.mk` | 도커 컨테이너 브라우저 테스트 도구 |
| `scripts/tools/tools.mk` | `docker/tools/tools.mk` | 개발 툴즈(Gitea, Jupyter 등) 구동 명령어 |
| `scripts/agents/agents.mk` | `.agents/scripts/agents.mk` | 에이전트 CLI 관리 및 헬퍼 목록 |
| `scripts/agents/commit-changes.sh` | `.agents/scripts/commit-changes.sh` | 변경 사항 자동 Git 커밋 스크립트 |
| `scripts/agents/push-changes.sh` | `.agents/scripts/push-changes.sh` | 변경 사항 자동 Git 푸시 스크립트 |
| `scripts/agents/review-changes.sh` | `.agents/scripts/review-changes.sh` | 변경 사항 자동 정적 리뷰 스크립트 |
| `scripts/agents/squash-artifacts.sh` | `.agents/scripts/squash-artifacts.sh` | 아티팩트 압축 스크립트 |

---

## 🛠️ 수정이 필요한 대상 파일 및 변경 사항

### 1. 루트 [Makefile](file:///Users/ejpark/workspace/scraper/Makefile)
- 기존 `scripts/` 경로를 바라보던 `include` 구문과 `-f` 옵션 경로들을 새로운 경로로 갱신합니다.
- 예: `include scripts/environments.mk` ➡️ `include docker/environments.mk`
- 예: `@$(MAKE) -f scripts/agents/agents.mk $*` ➡️ `@$(MAKE) -f .agents/scripts/agents.mk $*`

### 2. [agents.mk](file:///Users/ejpark/workspace/scraper/scripts/agents/agents.mk) (이동 후 경로: `.agents/scripts/agents.mk`)
- 내부에서 `@bash scripts/agents/...` 나 `@$(MAKE) -f scripts/agents/...` 형태로 자기 자신이나 동료 스크립트를 호출하는 경로를 `.agents/scripts/...`로 수정합니다.

---

## 🏁 자가 검증 (Validation)
작업 완료 후 다음 명령어들을 실행하여 기존 동작들이 문제없이 유지되는지 확인합니다:
1. `make mongo-status` 또는 기타 인프라용 메이크 명령어 호출 검증
2. `make agents-usage` 또는 `make agents-commit` 명령 실행 시 경로 오류 없이 스크립트가 실행되는지 검증
