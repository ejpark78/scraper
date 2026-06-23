# 066-split-git-flow-rules.review.md

본 검토서는 [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md)의 대대적인 쪼개기 작업에 대한 수정 상세 계획과 가이드 문서 구조 검토를 담고 있습니다.

---

## 🔍 수정 전/후 대비 (Before vs After)

### 1. AGENTS.md 크기 및 가독성 최적화
* **[수정 전]**: 130라인이 넘는 파일로 Docker 볼륨 마운트 문제, Git Flow의 세부 절차, 문서화 수명 주기의 복잡한 표 등이 모두 본문에 포함되어 있어, 매 호출 시 컨테이너가 불필요하게 많은 텍스트 토큰을 소비하고 있었음.
* **[수정 후]**: 
  - 에이전트의 강제 행동 지침(Bash 명령어 통제, Docker 호스트 포트 직접 노출 금지, Git Flow main 직접 수정 금지, 보안 규칙 등)만 요약 형태로 본문에 명시.
  - 구체적인 매뉴얼 및 가이드는 4개의 서브 가이드 문서로 쪼개어 필요할 때만 참조하도록 링크로 연동.

---

## 📂 신규 가이드 문서 구조 설계

### A. [git-flow.md](file:///Users/ejpark/workspace/scraper/docs/guides/git-flow.md)
- **주요 내용**: `main`/`develop`/`feature`/`release`/`hotfix` 브랜치의 정의 및 용도, Conventional Commits 메시지 규격, 최신화 및 브랜치 이동 프로세스, 머지 충돌 시 행동 가이드.

### B. [tech-stack.md](file:///Users/ejpark/workspace/scraper/docs/guides/tech-stack.md)
- **주요 내용**: Python(PEP 8, Type Hinting, `uv` 의존성 도구 사용), TypeScript & Vue 3(script setup, Composition API, Eslint/Prettier 연동).

### C. [docker-environment.md](file:///Users/ejpark/workspace/scraper/docs/guides/docker-environment.md)
- **주요 내용**: Docker Compose 기반 로컬 빌드/테스트 절차, 볼륨 마운트 시의 호스트 `node_modules` 덮어쓰기 방지책, Traefik 프록시 경유 도메인 라우팅 정책(호스트 포트 노출 금지), Netshoot를 이용한 진단 툴 가이드.

### D. [documentation-lifecycle.md](file:///Users/ejpark/workspace/scraper/docs/guides/documentation-lifecycle.md)
- **주요 내용**: Spec -> Plan -> Review -> Walkthrough 문서 작성 순서, 3자리 순차 번호 접두사를 지닌 `docs/artifacts/` 보존 명명 규칙, 변경 등급별(Major/Minor/Trivial) 필수 문서 표, Squash 및 Archive 정책.

---

## ⚠️ 잠재적 영향도 및 위험 분석
* **가장 큰 위험**: 가이드 문서로 쪼개진 세부 규칙(예: "Vue 3 컴포넌트 개발 시 Composition API 사용")을 에이전트가 코딩 작업 시 링크를 통해 상기하지 않아 무시할 위험이 있습니다.
* **위험 완화 전략**: [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md)의 핵심 요약 부문에 "코딩 작업 전 반드시 [Tech Stack Guide](file:///...)를 로드하여 세부 언어 규칙을 준수할 것" 과 같이 에이전트의 강제 행동 지침에 바인딩하여 해결합니다.
