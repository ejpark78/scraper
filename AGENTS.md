# 🤖 Agent Project Rules (AGENTS.md)

## 🎯 Project Vision

이 프로젝트는 LinkedIn, 기술 뉴스레터, 기술 서적 등 분산된 기술 정보를 수집·구조화하여 개발자를 위한 통합 기술 지식 허브를 구축합니다. 수집 → 정제 → 검색 → LLM 분석 파이프라인을 모노레포 환경에서 운영합니다.

---

## ⚠️ 주요 제약 사항 (Critical Constraints)

1. **임의 Bash 명령어 금지**: Pre-Approved 명령어를 제외한 모든 셸 명령어(읽기 전용 진단, git, docker, ls, env 등 포함)는 사용자의 명시적 승인이 필요합니다. 정확한 명령어를 채팅에 먼저 제시하고 승인을 받으세요. 여러 진단/상태 확인은 `&&`, `;` 또는 `cat << 'EOF' | bash`로 연결하여 단일 실행으로 압축하세요.
2. **계획 수립 철저 및 자율 일괄 실행**: 파일 쓰기나 환경 변경 전에 `docs/artifacts/` 디렉토리에 특정 파일명으로 계획서 파일(.plan.md)을 작성하여 제시하고 최종 승인을 받으세요.
   * **CRITICAL**: 계획서 파일 제안 단계에서는 실제 소스 코드나 설정 쓰기/수정 도구를 호출하지 말고 사용자의 명시적인 승인을 먼저 기다리세요.
   * **자율 실행**: 사용자로부터 계획서(.plan.md)가 최종 승인된 이후에는, 계획에 명시된 후속 작업(할 일 목록 작성, 실제 소스 코드 및 설정 파일 수정, 검토서 및 결과보고서 작성)을 추가적인 개별 승인 요청 없이 에이전트가 단일 턴에 자율적으로 일괄 작성하고 실행할 수 있습니다. (단, 추가적인 쉘 명령어 실행이나 외부 인프라 변경은 기존처럼 사용자의 명시적 승인이 요구됩니다.)
3. **최소 파일 범위 및 커버리지**: 루트 레벨 grep이나 재귀 list_dir을 사용하지 마세요.
   * 중첩 폴더를 놓치지 않고 프로젝트 구조를 파악하려면 `git ls-files`를 한 번 실행하세요.
   * 정확한 대상 파일 경로를 찾은 후 `Read`로 직접 읽으세요.
   * 여러 파일에서 코드 심볼을 검색할 때는 `Grep`을 사용하여 일치하는 라인 번호만 찾고, 파일을 하나씩 읽지 마세요 (API/토큰 소비 최소화).
4. **투명한 이슈 처리**: 오류는 즉시 보고합니다. 무음 복구 금지. 사용자 리뷰 없이 자가 트러블슈팅은 최대 2회.
5. **상대경로 링크**: 문서에서는 상대경로를 사용하세요 (예: `[Worker](src/Worker.ts)`). `file://` 사용 금지.
6. **자동 Git 커밋**: 유효한 편집 직후 `scripts/agents/commit-changes.sh`를 실행합니다.
7. **Docker 중심 테스트 및 실행**: 모든 로컬 스크립트는 `docker compose`로 테스트/실행합니다. 테스트/디버깅과 프로덕션 검증을 구분하세요:
   * **디버깅/테스트**: 항상 볼륨 마운트를 사용하여 소스 파일을 실시간 동기화. `docker cp` 사용 금지.
   * **프로덕션/검증**: 최종 빌드 이미지 검증 시 볼륨 마운트 없이 실행 (이미지 재빌드 후). MongoDB/Redis 접근이 Docker 네트워크 내에서 가능한지 확인.
   * **로컬 node_modules 마운트 문제**: `-v $(pwd):/app`으로 워크스페이스 마운트 시 호스트의 `node_modules`가 컨테이너 버전을 덮어씁니다. 라이브러리 버전 불일치를 방지하려면 익명 볼륨 마운트 추가: `-v /app/node_modules`.
   * **호스트 포트 노출 금지**: 인프라 서비스 포트(MongoDB `27017`, Redis `6379`, Meilisearch `7700`)를 호스트 머신에 직접 노출하지 마세요. 모든 트래픽은 Traefik 리버스 프록시 도메인(예: `*.localhost`, `*.nip.io`)을 통해 라우팅.
   * **Docker 내부 CLI 작업**: 인프라 서비스가 호스트에 포트를 노출하지 않으므로, CLI 유틸리티/진단/REST 작업(예: `curl` 명령어)은 `docker compose run`으로 컨테이너 네트워크 내에서 실행 (예: `docker compose -p scraper run --rm worker curl ...`). 호스트→localhost 직접 연결 시도 금지. CRITICAL: 네트워크/API 진단 시 기본 서비스 컨테이너에 패키지를 설치/수정하지 말고 `nicolaka/netshoot` 컨테이너 사용. 다만, 데이터베이스, Meilisearch 및 Redis 진단을 위해 뷰어 MCP 서버가 제공하는 전용 도구(`run_mongo_query`, `run_meili_query`, `run_redis_query`)가 구축되어 있는 경우, 사용자 승인이 필요한 셸 진단 대신 해당 MCP 도구를 우선 사용하여 진단을 수행하세요.
8. **트랜스크립트 내보내기 (수동 실행)**: 세션 시작 시 `make agents-dump`를 자동 실행하지 마세요. 사용자가 요청하거나 세션 결과를 요약할 때만 명령어 라인을 제공하세요.
9. **동시 백그라운드 작업 금지**: 경쟁 상태 및 DB/시스템 상태 손상을 방지하기 위해, 각 명령어에 대한 사용자의 명시적 승인 없이 여러 백그라운드 명령어/태스크를 병렬 실행하지 마세요. 활성 백그라운드 작업이 완전히 종료되고 종료 상태를 확인한 후에만 다음 명령어 승인을 요청하세요.
10. **데이터 변경은 사용자에게 위임**: 데이터 손상이나 충돌을 방지하기 위해, 에이전트는 주요 영구 데이터 변경, DB 시딩, 인덱스 리셋/재인덱싱(예: `meili-manager.ts --reset`)을 실행하거나 승인 요청하지 마세요. 대신 필요한 실행 단계와 명령어를 채팅에 명확히 설명하고 사용자가 수동으로 실행하도록 요청하세요.
11. **환경 제어 공동 위임 (페어 프로그래밍)**: 컨테이너 재빌드, 서비스 재시작, 이미지 정리, 복잡한 런타임 배포 등의 작업 실행 시, 에이전트는 협업 파트너처럼 행동하세요. 명령어를 직접 실행하지 말고, 목적과 명령어를 설명하며 사용자가 수동으로 실행하도록 요청하십시오.
12. **AI 처리 및 응답 한국어**: 모든 AI 처리 로그, 상태 메시지, 채팅 응답은 한국어로 작성합니다.
13. **범위 외 수정 금지**: 사용자가 명시적으로 요청한 범위 밖의 파일은 수정하지 마세요.
14. **추측 수정 금지**: 추측에 기반한 코드 수정은 엄격히 금지됩니다. 문제의 근본 원인을 모르면 사용자에게 문의하세요.
15. **개별 패키지 전용 규칙의 격리**: crawler 및 viewer 전용 세부 실행 방식/제약 조건은 각각 `apps/crawler/AGENTS.md` 및 `apps/viewer/AGENTS.md` 파일에 정의합니다. 에이전트는 해당 하위 디렉토리 작업 시 개별 규칙을 확인하고 준수해야 합니다.

## ⚠️ 보안 규칙 (Security Rules)
- **ENV 접근 금지**: `.env` 또는 `.env.*` 파일에 접근하지 마세요. `.env.example`을 참조하세요.
- **자격 증명 노출 금지**: API 키/자격 증명을 명령어 출력에 노출하지 마세요.

## ⚙️ 엔지니어링 및 아키텍처 규칙 (Engineering & Architecture Rules)

1. **Strict OOP Patterns**: 클래스, 인터페이스, SOLID 원칙을 사용합니다. 핵심 로직에 느슨한 유틸리티 함수 사용을 지양합니다.
2. **Strict Typing**: 'any' 타입 사용을 금지합니다. public 메서드에 명시적 반환 타입과 인터페이스를 선언합니다.
3. **Robust Error Handling**: 빈 catch 블록을 사용하지 마세요. 항상 에러 컨텍스트를 로깅하고 finally 블록에서 DB/Redis 연결을 종료합니다.
4. **Centralized Config**: 'process.env'는 전용 설정 파일에서만 접근합니다. 생성자를 통해 설정을 주입합니다.
5. **Agent-Friendly Docstrings**: 모든 소스, 스크립트, 자동화 파일에 설계 컨텍스트, 제약 조건, 의존성을 설명하는 헤더 docstring/주석을 추가하여 리팩터링 루프를 방지합니다. 동작 변경 시 업데이트합니다.
6. **No Superficial Patches**: 오류 발생 시 표면적 패치(예: 커스텀 regex 제외나 하드코딩 파라미터로 증상 숨기기)를 절대 구현하지 마세요. 항상 데이터 흐름을 추적하고, DB/상태 조정을 조사하여 진정한 근본 원인을 찾아 견고한 구조적/아키텍처 솔루션을 구현하세요. **또한 버그가 수정(Bugfix)되었을 때에는 단순 변경사항과 엄격히 구분하여 CHANGELOG와 코드 리뷰 문서에 'Bugfix'임을 명확히 표기하고 기록해야 합니다.**

## 📝 Documentation Lifecycle Rules

에이전트는 모든 설계 및 기능 변경 작업을 수행할 때 아래의 **문서화 수명 주기(Documentation Lifecycle)**를 준수해야 합니다.

1. **문서화 수명 주기 순서**:
   Spec (.spec.md) -> Plan (.plan.md) -> Review (.review.md + .task.md) -> Walkthrough (.walkthrough.md)
   - PRD는 필요 시에만 작성 (선택), ADR은 구조적 설계 분기 시에만 작성
   - 테스트 시나리오는 Review 단계에서 `.test.md`로 포함

2. **디렉토리 표준 및 명명 규칙**:
   - **`docs/artifacts/`**: 모든 요구 정의 명세(Spec), 아키텍처 의사결정(ADR), 설계/계획, 태스크, 코드 리뷰, 결과보고서, 장애 분석, 테스트 시나리오 문서를 단일 디렉토리에서 관리합니다. 각 히스토리별로 **3자리 순차 번호 접두사**를 매겨 관련 파일들을 용도별 접미사(종류)로 구분하여 보존합니다.
      - 요구명세서: `###-filename.spec.md` (예: `001-integrate-ebook-service.spec.md`)
      - 의사결정서: `###-filename.adr.md` (예: `023-redis-namespace-restructuring.adr.md`)
      - 계획서: `###-filename.plan.md` (예: `022-integrate-joplin-obsidian-exporter.plan.md`)
      - 리뷰 문서: `###-filename.review.md`
      - 할 일 목록: `###-filename.task.md`
      - 결과보고서: `###-filename.walkthrough.md`
      - 장애 분석/트러블슈팅: `###-filename.issue.md` (템플릿: [issues_template.md](docs/templates/issues_template.md))
      - 테스트 시나리오: `###-filename.test.md` (템플릿: [tests_template.md](docs/templates/tests_template.md))
   - **`CHANGELOG.md`**: 프로젝트 루트의 단일 파일로 릴리즈 버전 및 마일스톤 단위의 전체 변경 이력을 통합 관리합니다. (개별 changelog 폴더 분할은 지양)

3. **변경 규모별 문서화 의무 차등**:

| 등급 | 대상 | 필수 문서 |
|------|------|----------|
| **Major** | 기능 추가, 아키텍처 변경, Bugfix | `.review.md` + `.task.md` + `.walkthrough.md` |
| **Minor** | 리팩터링, 설정/패키지/의존성 변경 | `.task.md` 1종 (축약형) |
| **Trivial** | 오타, 주석, 문서만 변경 | CHANGELOG.md 1줄 (번호 미부여) |

- **Bugfix**는 등급과 무관하게 `.review.md`/`.task.md` 상단에 **Bugfix** 명시
- Major 누락 시 최종 Done 보고 불가

4. **자가 검증 및 지속적 개선**:
   - 자가 검증 루프는 모든 변경(Major/Minor/Trivial)에 필수
   - 순서: 편집 반영 확인 → CHANGELOG 갱신 확인 → lint/build 정상 확인 → Done 보고
   - dump loop, 누락된 수정, 반복 실패 발생 시 `docs/artifacts/`에 `.issue.md`로 원인 기록 (현상 → 원인 → 방지책)
   - 세션 시작 시 최근 `.issue.md`(최대 3개)를 참조하여 동일 패턴 예방

5. **아티팩트 Squash 및 Archive 정책**:
   - `make agents-squash`로 `.review.md` + `.task.md` + `.walkthrough.md` 3종을 `.summary.md` 1개로 압축 (토큰 ~66% 절약)
   - 압축 후 번호가 매겨진 모든 아티팩트 파일들을 10개 단위로 묶어 `###-###.archive.md` 파일로 통합 아카이빙하고 원본을 제거합니다.
   - `.spec.md`, `.adr.md`, `.plan.md`, `.issue.md`, `.test.md`는 원본 유지
   - 세션 종료 시 아티팩트 수가 50개 초과이면 `make agents-squash` 실행 제안



## 🧭 Agent Skill Directory Map

작업 시 컨텍스트에 따라 해당 Skill 파일을 활성화/참조하세요:

| 컨텍스트 | Skill 파일 | 설명 |
|:---|:---|:---|
| 사이트 크롤러/파이프라인 | [develop_sites_skills.md](.agents/skills/develop_sites_skills.md) | Bronze→Silver 파이프라인, Base 클래스 |
| DB/인덱스 | [database_skills.md](.agents/skills/database_skills.md) | MongoDB/Redis 스키마, 인덱스 |
| HTML/스크래핑 디버깅 | [html_debugging_skills.md](.agents/skills/html_debugging_skills.md) | HtmlDebugger 유틸, HTML 덤프 |
| Firecrawl 웹 검색 | `~/.claude/skills/firecrawl-*/` | Firecrawl CLI 스킬들 |

## 💡 Token Efficiency Rules

1. **아티팩트 사전 스캔 금지**: `docs/artifacts/` 문서는 자동으로 읽지 않음. 필요 시 INDEX.md에서 번호 확인 후 직접 Read
2. **AGENTS.md 유지보수**: AGENTS.md는 100줄 이내 유지. 불필요한 예제/중복 발견 시 정리
3. **Compact 정기 정리**: 10세션마다 또는 아티팩트 50개 초과 시 `make agents-squash` 권장

## 🔓 사전 승인 명령어 (Pre-Approved Commands)

다음 명령어/스크립트는 사전 승인되었으며, 규칙 1과 2의 승인 절차에서 제외됩니다:
- `git ls-files` (토큰/API 사용 최소화를 위한 읽기 전용 프로젝트 코드베이스 매핑)
- `scripts/agents/commit-changes.sh` (편집 후 자동 실행되어 진행 상황 저장)
