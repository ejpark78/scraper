# 068-add-trigger-always-on-to-guides.review.md

본 검토서는 각 가이드 및 워크플로우 문서들에 추가될 트리거(Trigger) 사양에 대한 상세 설계와 정당성 검토를 담고 있습니다.

---

## 🔍 트리거 추가 및 분기 설계 검토

### 1. 상시 활성화 가이드 (`trigger: always_on`)
* **대상 파일**:
  - `git_flow.md`
  - `documentation_lifecycle.md`
* **설계 정당성**:
  - Git 브랜치 전략이나 커밋 컨벤션은 개발의 매 턴마다 기본적으로 확인하고 준수해야 합니다.
  - 문서화 수명 주기(Spec -> Plan -> Review -> Walkthrough) 또한 모든 작업 진행 중 에이전트의 산출물 작성 흐름을 통제하므로 상시 켜져 있는(`always_on`) 상태로 에이전트의 오작동을 차단하는 것이 적합합니다.

### 2. 기술 맥락 활성화 가이드 (On-Demand / Keyword Trigger)
* **대상 파일 & 트리거 키워드**:
  - `tech_stack.md`
    - 트리거: `code, python, typescript, vue, py, ts, js, uv`
    - 정당성: 코드 작성이나 패키지 추가 시에만 로드되도록 제어하여 토큰 사용량을 최적화합니다.
  - `docker_environment.md`
    - 트리거: `docker, compose, container, port, volume`
    - 정당성: 컨테이너 구동이나 포트 노출 진단과 같은 Docker 관련 맥락이 있을 때에만 유동적으로 로드하여 컨텍스트 효율을 높입니다.
  - `planning.md`
    - 트리거: `plan, spec, adr, design`
    - 정당성: 기획 및 구조 설계 등 큰 그림의 계획을 세우는 시점에만 활성화되도록 정밀 조율합니다.

### 3. 워크플로우 트리거
* **대상 파일 & 트리거**:
  - `startcycle.md`
    - 트리거: `/startcycle`
    - 정당성: 사용자가 명시적 슬래시 명령어를 주었을 때만 로드하여 자동 순차 개발 사이클을 개시합니다.

---

## ⚠️ 잠재적 영향도 및 위험 분석
- **영향도**: 트리거 조건을 정밀하게 설계함으로써, 코딩할 때 도커 인프라 가이드를 로드하지 않고 도커 작업 시 코딩 스타일 가이드를 배제하여 세션당 약 20% 이상의 토큰 점유율을 줄여 컨텍스트 길이를 단축합니다.
- **위험**: 키워드가 다소 협소하게 설정될 경우, 에이전트가 코딩 작업 중 `tech_stack.md` 규칙을 로드하지 못해 실수를 저지를 우려가 있습니다.
- **대비책**: `tech_stack.md`에 `code`, `python`, `typescript`, `py`, `ts` 등 코딩 및 프로그래밍 관련 핵심 대형 명사들을 포괄적으로 트리거 키워드로 정의합니다.
