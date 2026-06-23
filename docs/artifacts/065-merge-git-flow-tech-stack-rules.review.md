# 065-merge-git-flow-tech-stack-rules.review.md

본 검토서는 [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md)의 Git Flow 전략 및 기술 스택 엔지니어링 규칙 수정에 대한 상세 설계 대비 및 영향도 분석을 담고 있습니다.

---

## 🔍 수정 전/후 대비 (Before vs After)

### 1. Git Flow 브랜치 및 커밋 전략

#### [수정 전]
* 브랜치 규격: `main`(배포, 직접 커밋 금지), `develop`(통합 개발 브랜치, 기본 작업 대상), `feature/###-<name>`(기능 개발, 아티팩트 번호 필수), `hotfix/###-<name>`(긴급 버그 수정)
* 에이전트는 `.plan.md` 작성 시 대상 브랜치 명시 및 전환 승인 요청. 작업 완료 후 `develop` 병합 및 브랜치 삭제 승인 요청.

#### [수정 후]
* 브랜치 규격 확장: `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`에 대한 상세 설명 제공.
* Conventional Commits 강제 적용 (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
* 명확한 **작업 및 병합(Merge) 절차** 규정 추가:
  - 작업 전 `develop` 및 `main` 최신화 (`git pull`).
  - 브랜치 전환 전 로컬 변경 사항 커밋(`commit-changes.sh` 실행) 또는 `stash` 의무화.
  - 머지 충돌 발생 시 임의 강제 푸시(`--force`) 금지 및 보고.
  - 빌드/린트 검증 필수.
  - 개발 도중 `main` 직접 제어/커밋 절대 금지.

---

### 2. 기술 스택별 엔지니어링 규칙 (Tech Stack Rules)

#### [수정 전]
* TypeScript의 OOP 패턴, Strict Typing (`any` 금지) 등 일반적인 아키텍처 규칙만 명시되어 있었음.

#### [수정 후]
* **🐍 Python**: Python 3.11+, PEP 8 준수, Type Hinting 필수, `uv`를 통한 패키지 관리(requirements.txt 배제).
* **🔷 TypeScript & Vue 3 (Frontend)**: Composition API / `<script setup>` 명시, `any` 금지 유지, ESLint/Prettier 자동 감지 포맷팅 규칙.
* **🐳 Docker Compose (Infrastructure)**: 로컬 개발 시 볼륨 마운트 검증, 빌드 오류 시 캐시 파괴 후 재빌드(`--build`) 권장, 호스트 포트/볼륨 충돌 방지 가이드.

---

## ⚠️ 잠재적 영향도 및 위험 분석
* **영향도**: 규칙이 명확해짐으로써 에이전트가 다른 프로젝트 브랜치 전략이나 파이썬 패키지 관리 방식을 사용하는 오류를 미연에 방지할 수 있습니다.
* **위험**: 에이전트 행동 지침 및 Git 흐름에서 명시된 `commit-changes.sh` 실행 시점(전환 전 커밋)을 지키지 않을 시 변경 내역이 타 브랜치로 유출될 수 있으므로, 해당 시점을 강력하게 가이드라인에 뇌이징합니다.
