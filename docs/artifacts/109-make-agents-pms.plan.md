# 📋 109-make-agents-pms.plan.md

이 계획서는 로컬 개발 환경의 Markdown 아티팩트(`docs/artifacts/`)들을 Gitea(Issues) 및 Vikunja(Tasks/Kanban)로 양방향 동기화 및 자동 생성하는 `make agents-pms` 명령어 도입 계획을 정의합니다.

---

## 🎯 목표

1. **단일 명령어를 통한 동기화**: `make agents-pms` 실행 시 로컬 `docs/artifacts` 내의 아티팩트 목록을 스캔하여 Gitea 및 Vikunja와 자동 연동합니다.
2. **소급 적용 (Backfilling)**: 신규 생성된 아티팩트뿐만 아니라 기존에 존재하는 모든 아티팩트들도 파일명 접두사(`###`) 기준 멱등성(Idempotency)을 유지하며 일괄 업서트(Upsert)합니다.
3. **독립성 유지**: Docker Compose 네트워크 내에서 동기화 스크립트가 실행될 수 있도록 개발합니다.

---

## 🏗️ 상세 아키텍처 및 통신 모델

### 1. 매핑 전략
* **Gitea**: 
  * 아티팩트 번호(`###`)가 이슈 번호(Issue Index)와 매핑되거나 이슈 타이틀에 접두사 `[SCR-###]`로 매핑됩니다.
  * 아티팩트 내용(`.plan.md`, `.task.md`, `.walkthrough.md`)은 해당 이슈의 설명(Description)에 통합 테이블로 구성되거나 코멘트(Comment)로 업데이트됩니다.
* **Vikunja**:
  * 동일한 작업 번호(`###`)의 카드가 보드에 생성됩니다.
  * 아티팩트 완성 단계에 따라 카드가 자동으로 이동합니다.
    * `.plan.md`만 존재: `Planned` (계획됨)
    * `.task.md` 존재: `In Progress` (진행 중)
    * `.walkthrough.md` 존재: `Done` (완료됨)

### 2. 실행 구조
```makefile
agents-pms:
	docker compose -p scraper exec -T app-node uv run ts-node scripts/agents/sync-pms.ts

# Gitea 및 Vikunja API 토큰 CLI 생성 통합 헬퍼 (비대화형 완전 자동화)
agents-pms-token:
	@echo "=============================================================================="
	@echo "⚙️  Gitea & Vikunja PMS 동기화용 환경 변수 설정 안내"
	@echo "아래 텍스트 블록을 복사하여 프로젝트 최상위의 .env 파일에 추가해 주십시오."
	@echo "=============================================================================="
	@echo ""
	@echo "GITEA_API_URL=https://gitea.127.0.0.1.nip.io/api/v1"
	@sqlite3 data/.services/gitea/gitea/gitea.db "DELETE FROM access_token WHERE name='agents-pms-sync';" 2>/dev/null || true
	@g_tok=$$(docker compose -p scraper exec -it gitea gitea admin user generate-access-token --username gitea-admin --token-name agents-pms-sync --scopes all 2>/dev/null | grep -o 'Access token was successfully created:.*' | cut -d' ' -f6 | tr -d '\r' | tr -d '\n'); \
	 if [ -n "$$g_tok" ]; then \
	   echo "GITEA_API_TOKEN=$$g_tok"; \
	 else \
	   echo "GITEA_API_TOKEN=기존_발행된_Gitea_토큰_값 (토큰 재생성 실패)"; \
	 fi
	@echo "VIKUNJA_API_URL=https://vikunja.127.0.0.1.nip.io/api/v1"
	@v_tok=$$(curl -k -s -X POST https://vikunja.127.0.0.1.nip.io/api/v1/login \
	   -H "Content-Type: application/json" \
	   -d '{"username": "vikunja-admin", "password": "admin12345"}' | tr -d '\r' | tr -d '\n' | sed 's/.*"token":"\([^"]*\)".*/\1/'); \
	 if [ -n "$$v_tok" ]; then \
	   echo "VIKUNJA_API_TOKEN=$$v_tok"; \
	 else \
	   echo "VIKUNJA_API_TOKEN=Vikunja_로그인_실패"; \
	 fi
	@echo ""
	@echo "=============================================================================="
```










---

## 🛠️ 구현 작업 목록

### Phase 1: 환경 분석 및 설정 정의
* Gitea 및 Vikunja 컨테이너의 서비스 도메인 및 API URL 설정 (`.env.example` 및 `src/config/AppConfig.ts` 또는 유사 구성 연동).
* 연동용 토큰 변수 정의 (`GITEA_API_TOKEN`, `VIKUNJA_API_TOKEN`).

### Phase 2: 동기화 스크립트 개발 (`scripts/agents/sync-pms.ts`)
* `docs/artifacts/` 전체 스캔 및 아티팩트 그룹화 (접두사 번호 기준).
* **아카이브 파싱 및 복원**: `###-###.archive.md` 형식의 아카이브 압축 파일을 탐색하여, 마크다운 본문 파싱을 통해 과거 1번부터 100번까지의 각 개별 아티팩트 본문 및 메타데이터를 개별 `ArtifactGroup` 객체로 동적 추출/복원하고 개별 이슈로 변환하는 로직 구현.
* **조건부 프로젝트 리셋 옵션**: 무조건적인 리셋을 배제하고, 실행 시 `--reset` 인자가 주입되었을 때만 조건부로 Gitea 저장소 및 Vikunja 프로젝트를 파괴(DELETE)하도록 구현. 평상시 기본 동작은 멱등성 있는 추가/업데이트(Upsert)로 작동하여 데이터 보존.
* **역사적 아티팩트 상태 제어**: 아카이브 구간에 해당하는 **100번 이하(SCR-001 ~ SCR-100)**의 아티팩트들은 이미 완료된 프로젝트 역사이므로, Gitea 이슈 상태를 무조건 `closed`, Vikunja 버킷을 무조건 `Done`으로 매핑하여 강제 동기화.
* Gitea API 호출 로직:
  * Repository 검색/생성.
  * Issue 검색/생성/본문 업데이트 (아카이브 추출 정보 포함).
* Vikunja API 호출 로직 (Project View 기반 버킷 맵핑):
  * Project/Board 검색/생성.
  * 디폴트 Kanban View 조회 및 획득 (`GET /projects/{id}/views`).
  * View 소속 Standard Buckets(Planned, In Progress, Done) 생성 및 확인 (`/projects/{id}/views/{viewId}/buckets`).
  * Task 생성 후, View의 특정 버킷으로 관계 설정 및 이동 API 호출 (`POST /projects/{id}/views/{viewId}/buckets/{bucketId}/tasks`)을 수행하여 멱등성 있는 카드 배치 달성.



### Phase 3: Makefile 통합 및 테스트
* `Makefile`에 `agents-pms` 타겟 추가 (기본 멱등 업데이트).
* `Makefile`에 `agents-pms-reset` 타겟 추가 (`--reset` 인자 주입하여 전체 파괴 후 재생성).
* 기존 `docs/artifacts` 내 전체 아티팩트(소급 적용) 대상 동기화 테스트 및 검증.

### Phase 4: CLI 토큰 생성 헬퍼 및 계정 검증 추가
* `agents.mk`에 `agents-pms-token` 타겟을 추가하되, TTY 오류를 방지하기 위해 `exec -T` 대신 `-it`를 사용하도록 수정.
* `tools.mk`의 `up-vikunja` 규칙 내에서 계정 생성 시 TTY 에러가 발생하지 않도록 패스워드를 표준 입력(STDIN)으로 안전하게 넘겨주고, 생성이 완료된 후 다시 한 번 계정이 성공적으로 존재하는지 검증(Test)하는 출력 로직을 통합.
