# 105-make-agents-push.plan.md

로컬 변경 사항을 원격지에 간편히 푸시하고 릴리즈 배포를 완료하기 위해 `make agents-push` 명령어를 설계합니다.

---

## 🎯 1. 목적 (Objectives)
* **`make agents-push` 명령어 구축**: 터미널에서 명령어 입력만으로 로컬 `develop` 브랜치의 커밋들을 `main`에 안전하게 머지하고, 최종적으로 원격 저장소(`origin`)에 `develop`과 `main` 브랜치 모두를 정합하게 동기화(push)하는 개발 편의 기능을 제공합니다.
* **배포 수명 주기 단축**: 반복적인 git 명령어 타이핑(머지, 브랜치 전환, 개별 푸시 등)을 단 하나의 단축 명령으로 묶어 릴리즈 워크플로우를 단순화합니다.

---

## 🏗️ 2. 설계 및 아키텍처 (Architecture & Design)

### A. 브랜치 머지 및 푸시 셸 스크립트 작성
* `scripts/agents/push-changes.sh` 스크립트를 새로 구성합니다.
* 동작 프로세스:
  1. 현재 브랜치가 `develop`인지 점검합니다. (피처 브랜치일 경우 병합을 거쳐 `develop`으로 최종 진입하도록 유도하거나, 기본 develop 진입을 보증합니다.)
  2. 로컬 `develop`의 신규 변경 사항을 원격지에 푸시합니다 (`git push origin develop`).
  3. `main` 브랜치로 임시 전환(`git checkout main`)한 후, 로컬 `develop`을 머지(`git merge develop`)합니다.
  4. 머지 완료된 로컬 `main`을 원격지에 푸시합니다 (`git push origin main`).
  5. 작업이 끝나면 원래의 `develop` 브랜치로 정합하게 복구(`git checkout develop`)시킵니다.

### B. Makefile 타겟 및 단축어 연동
* `scripts/agents/agents.mk`에 `push` 타겟을 등록합니다.
* `push` 호출 시 위의 셸 스크립트(`push-changes.sh`)를 호출하게 연결합니다.

---

## 📝 3. 작업 상세 범위 (Implementation Tasks)
* **`scripts/agents/push-changes.sh` 추가**: 브랜치 교차 머지 및 푸시 핵심 스크립트.
* **`scripts/agents/agents.mk` 수정**: `push` 타겟 추가.
* **`docs/artifacts/INDEX.md` 및 `105-make-agents-push` 산출물** 업데이트.

---

## 🔍 4. 자가 검증 방법 (Verification Steps)
1. **명령어 동작 검증**: `make agents-push` 호출 시 로컬 머지 분기 처리 및 `git checkout` 복원 과정이 안전하게 수행되는지 스크립트 오동작(Conflict 등)에 대한 방어 로직이 작동하는지 체크합니다.
