# 📋 할 일 목록 (053-add-container-watchdog.task.md)

## 📌 개요
- **목적**: 컨테이너 락 상태 및 비정상 정지 현상을 자동 감지하고 자동 재시작 복구가 가능하도록 autoheal 와치독 및 하트비트 기반 헬스체크 구축.
- **등급**: **Major**

---

## 🛠️ 작업 목록

### 1단계: 글로벌 규칙 및 인프라 구성
- [x] `AGENTS.md` 파일에 하트비트 헬스체크 및 autoheal 와치독 규칙 추가.
- [x] `docker/infra/autoheal/compose.yml` 파일 작성 (willfarrell/autoheal 이미지 사용).
- [x] 루트 `compose.yml` 파일의 `include`에 `docker/infra/autoheal/compose.yml` 등록.

### 2단계: 소스 코드 및 컨테이너 설정 수정
- [x] `apps/crawler/src/workers/ScraperWorker.ts` 내 하트비트 업데이트 로직 적용.
- [x] `apps/crawler/src/workers/ConverterWorker.ts` 내 하트비트 업데이트 로직 적용.
- [x] `apps/crawler/docker/worker/compose.yml` 내 `scraper` 및 `converter` 서비스에 autoheal 라벨(`autoheal: "true"`) 부여 및 헬스체크 명령어를 하트비트 대조 쉘 명령으로 업데이트.

### 3단계: 문서화 및 검증
- [x] `CHANGELOG.md` 및 `apps/crawler/CHANGELOG.md` 갱신.
- [x] `.review.md` 및 `.walkthrough.md` 작성.
- [ ] 타입 검증 및 빌드 확인 요청.
- [x] `scripts/agents/commit-changes.sh` 실행 및 완료 보고.
