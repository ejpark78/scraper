# 🔍 코드 리뷰 문서 (053-add-container-watchdog.review.md)

## 📌 리뷰 개요
- **작업명**: 컨테이너 와치독 및 하트비트 헬스체크 추가
- **수정 파일**:
  - [AGENTS.md](file:///home/ejpark/workspace/scraper/AGENTS.md)
  - `docker/infra/autoheal/compose.yml` (신규)
  - [compose.yml](file:///home/ejpark/workspace/scraper/compose.yml)
  - [apps/crawler/docker/worker/compose.yml](file:///home/ejpark/workspace/scraper/apps/crawler/docker/worker/compose.yml)
  - [ScraperWorker.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/workers/ScraperWorker.ts)
  - [ConverterWorker.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/workers/ConverterWorker.ts)
- **리뷰 유형**: **Major**
- **작성일**: 2026-06-23

---

## 🛠️ 수정 사항 분석 및 자가 검토

### 1. AGENTS.md 에 모니터링 규칙 추가
- **내용**: 7번 항목에 컨테이너 와치독 및 하트비트 관련 규칙을 명문화하여, 향후 개발 시에도 본 모니터링 아키텍처가 유지되도록 가이드라인 명시.

### 2. Autoheal 컨테이너 신설
- **내용**: `willfarrell/autoheal`을 통해 Docker 소켓 감시 방식을 구축하여 `unhealthy` 상태의 컨테이너가 있을 때 자율적으로 Docker API를 호출해 컨테이너를 재시작하게 처리.

### 3. 하트비트 로직 & 헬스체크 정밀화
- **기존 문제**: 프로세스 생존 검사(`pgrep`)만 수행하여 데드락 발생 시 오작동 감지 불가.
- **수정 사항**:
  - `ScraperWorker`, `ConverterWorker` 내부 루프 시작 부분 및 큐 대기 타임아웃 종료마다 하트비트 파일 터치.
  - Docker Compose 헬스체크 시 3분 이내로 파일 수정 시간(mtime)이 업데이트되었는지 `find` 명령어로 교체.
- **결과**: 루프가 완전히 정체될 경우 정확하게 `unhealthy`로 전이되며 autoheal과 연동되어 안전하게 자동 재부팅 됨을 보장.
