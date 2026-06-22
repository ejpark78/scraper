# Plan - AGENTS.md 규칙 분리 (apps/crawler, apps/viewer)

루트 `AGENTS.md`에서 `apps/crawler` 및 `apps/viewer`에 해당하는 개별 전용 규칙들을 각각의 디렉토리 하위 `AGENTS.md`로 분리하여 코드 가독성 및 컨텍스트 효율을 극대화합니다.

---

## 🎯 목표

1. **루트 [AGENTS.md](file:///home/ejpark/workspace/scraper/AGENTS.md) 다이어트**:
   - `apps/crawler` 및 `apps/viewer` 관련 특정 Docker 실행 예시, Playwright 브라우저 대응, 재귀 수집 제약 조건 등을 루트에서 제거합니다.
2. **[apps/crawler/AGENTS.md](file:///home/ejpark/workspace/scraper/apps/crawler/AGENTS.md) 신규 생성**:
   - 크롤러 실행 커맨드 예시, Playwright 브라우저 버전 불일치 대응법, 재귀 수집 금지 규칙, 크롤러/파이프라인 관련 Skill Map 항목을 배치합니다.
3. **[apps/viewer/AGENTS.md](file:///home/ejpark/workspace/scraper/apps/viewer/AGENTS.md) 신규 생성**:
   - 뷰어 컴파일 및 빌드 방식, 뷰어에 최적화된 Docker 커맨드 및 진단/수동 실행 규칙을 배치합니다.

---

## 🛠️ 상세 작업 계획

### Step 1. `apps/crawler/AGENTS.md` 작성
- **내용**: 
  - Docker 중심 테스트 규칙 중 `worker`에 관한 설명 (`docker compose ... worker npx ts-node src/...`)
  - Playwright 브라우저 버전 불일치 문제 대응 가이드
  - 재귀 수집 금지 및 1회성 수집 고정 규칙 (`RECURSIVE_SCRAPE` 제거 컨텍스트)
  - 사이트 크롤러/파이프라인 및 HTML 디버깅 Skill Map

### Step 2. `apps/viewer/AGENTS.md` 작성
- **내용**:
  - Docker 중심 테스트 규칙 중 `viewer`에 관한 설명 (호스트 볼륨 마운트 없는 격리 컨테이너 빌드 및 배포 규칙)
  - 환경 제어 공동 위임 관련 예시 (`make up-viewer` 등)

### Step 3. 루트 `AGENTS.md` 업데이트
- **내용**:
  - 공통적인 핵심 규칙(명령어 승인, 계획 수립, OOP, Typing, Doc Lifecycle 등)만 남겨두고, 크롤러/뷰어 세부 규칙들(7번 항목 내부 세부항목 일부, 15번 항목 전체)을 삭제합니다.

### Step 4. 자가 검증 및 `commit-changes.sh` 실행
- 변경 내용 확인 후 `scripts/agents/commit-changes.sh`를 실행하여 버전 관리에 기록합니다.

---

## 📝 변경 대비표 (예상)

### 루트 `AGENTS.md` 수정안 (삭제 대상)
- **7. Docker 중심 테스트 및 실행** 내 아래 항목 제거:
  - `프론트엔드 컴파일 및 배포` 설명 -> `apps/viewer/AGENTS.md`로 이동
  - `Playwright 브라우저 불일치` 설명 -> `apps/crawler/AGENTS.md`로 이동
- **11. 환경 제어 공동 위임** 내 예시 단축 (공통 규칙화하되 viewer 중심 예시는 이동)
- **15. 재귀 수집 금지 및 1회성 수집 고정** 전체 삭제 -> `apps/crawler/AGENTS.md`로 이동

---

## 🚦 진행 승인 요청
본 계획서에 승인하시면 순차적으로 각 `AGENTS.md` 생성을 진행하겠습니다.
