# 📝 110-gitea-pms-integration.plan.md

이 계획서는 분산된 PMS 연동 구조를 개선하여 Vikunja 컨테이너 서비스를 완전히 걷어내고, Gitea 단일 서비스의 라벨(Label) 연동 프로젝트 보드(Kanban) 구조로 통합 초경량화하기 위한 기술적 구현 및 환경 전환 계획을 수립합니다.

---

## 🎯 1. 전환 목적 및 주요 변경 사항

* **인프라 초경량화**: 로컬 개발 리소스(CPU/Memory)를 과도하게 점유하고 세션 고정이 까다로웠던 Vikunja(PostgreSQL/Redis/API) 서비스를 Docker 가상 환경에서 완벽히 배제합니다.
* **Gitea 단일 통합**: 이슈 트래킹, 코드 리뷰(PR), 진행 관리 칸반 보드를 Gitea 단 한 곳으로 통합하여 도구의 파편화를 근본적으로 해결합니다.
* **라벨 기반 칸반 카드 자동 재배치**: Gitea 프로젝트 보드의 라벨 자동 필터링 기능(`status/planned`, `status/in-progress`, `status/done`)을 활용하여, 이슈 라벨이 갱신되는 순간 칸반 열 사이를 카드가 자동으로 왕복하도록 구성합니다.

---

## 🛠️ 2. 상세 작업 범위 및 구현 상세

### Phase 1: 도커 컨테이너 설정 및 Makefile 간소화
* **Docker Compose 수정**: `docker/tools/` 내부의 Vikunja compose 설정 배제 및 실행 환경 정리.
* **Makefile 및 `agents.mk` 리팩터링**: 
  * `agents-pms-token` 타겟에서 Vikunja 로그인 세션 및 JWT 토큰 발급 로직을 완전히 제거하고 오직 Gitea 토큰만 관리하도록 간소화.
  * `.env` 파일 내 `VIKUNJA_API_URL` 및 `VIKUNJA_API_TOKEN` 변수 종속성 제거.

### Phase 2: Gitea API 기반 상태 및 라벨 연동 고도화 (`sync-pms.ts`)
* **Vikunja 연동 제거**: `syncVikunja` 함수 및 관련 API 통신 모듈 완전 제거.
* **Gitea 라벨 자동 관리 기능 추가**:
  * 스크립트 기동 시 저장소 내에 `status/planned` (색상: `#d4c5f9`), `status/in-progress` (색상: `#fbca04`), `status/done` (색상: `#0e8a16`) 라벨이 존재하는지 검증하고, 없을 경우 자동 생성 (`POST /repos/{owner}/{repo}/labels`).
* **아티팩트 진행 상태별 Gitea 이슈 라벨 업데이트 구현**:
  * `Planned` 상태: 기존 status 라벨들을 제거하고 `status/planned` 라벨 주입.
  * `In Progress` 상태: 기존 status 라벨들을 제거하고 `status/in-progress` 라벨 주입.
  * `Done` 상태: 이슈를 Closed 상태로 업데이트하고, `status/done` 라벨 주입.
* **정밀 완료 검증**: 
  * 100번 이하 아카이브는 무조건 `Done` (Closed).
  * 101번 이상 최신 작업 중 `.task.md` 에 미완료 체크박스(`- [ ]`)가 남아있거나, 현재 활성 수정 세션(109/110번)의 경우 walkthrough가 있더라도 최종 검증 전까지 `In Progress` 라벨을 멱등 유지.
  * 체크박스가 전부 체크(`- [x]`)되고 walkthrough가 존재할 때만 최종 `Done` (Closed)으로 전환.

---

## 🚦 3. 검증 계획

### 1단계: 수동 Gitea 프로젝트 보드 설정 (최초 1회)
* Gitea 웹 브라우저 UI 접속 ➡️ `Projects` ➡️ `New Project` (제목: `scraper`) 생성.
* 3개의 Kanban 열 구성:
  * **Planned** 열: 자동 필터 규칙에 `status/planned` 라벨 설정.
  * **In Progress** 열: 자동 필터 규칙에 `status/in-progress` 라벨 설정.
  * **Done** 열: 자동 필터 규칙에 `status/done` 라벨 (또는 Closed) 설정.

### 2단계: 동기화 테스트 실행
* `make agents-pms-reset` 을 실행하여 Gitea 저장소를 리셋하고 79개의 아티팩트와 필요한 라벨들이 자동으로 생성 및 맵핑되는지 검사.
* Gitea 프로젝트 칸반 보드에서 이슈 카드들이 라벨 필터 규칙에 따라 각각의 열로 깔끔하게 물리적으로 자동 정렬 분산되는지 눈으로 확인.
