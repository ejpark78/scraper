# 🤖 Agent Project Rules (AGENTS.md)

## 🎯 Project Vision

이 프로젝트는 LinkedIn, 기술 뉴스레터, 기술 서적 등 분산된 기술 정보를 수집·구조화하여 개발자를 위한 통합 기술 지식 허브를 구축합니다. 수집 → 정제 → 검색 → LLM 분석 파이프라인을 모노레포 환경에서 운영합니다.

---

## ⚠️ Critical Constraints

1. **No Arbitrary Bash**: Consent required for ALL shell commands (including read-only diagnostics, git, docker, ls, env, etc.) except for Pre-Approved Commands. Present the exact command in chat for explicit approval first. Compress multiple diagnostics/status checks into a single chained execution (e.g. chaining with `&&`, `;`, or using `cat << 'EOF' | bash`) to minimize user confirmation loops.
2. **Strict Planning**: Propose a plan in a Markdown table (Columns: File Path, Action, Details) and obtain consent before file writes or env changes (except Pre-Approved). All design and migration plans must be documented in the 'docs/artifacts/' directory under a specific filename and approved by the user. CRITICAL: You must NOT call any write or modification tools in the same turn you propose a plan; always end your turn and wait for consent first. You must verify that the consent is explicitly granted by the human USER in a chat message. Do NOT interpret automated system notifications, background task completions, or other system-generated events as user consent to proceed.
3. **Minimal File Scope & Coverage**: Do not use root-level grep or recursive list_dir.
   * To map the project structure without missing nested folders, run a single `git ls-files` call once.
    * Pinpoint the exact target file path using the map, then use `Read` to read it directly.
    * If searching for code symbols across multiple files, use `Grep` to pinpoint the matching line numbers instead of reading files one-by-one, minimizing API/token consumption while maintaining full coverage.
4. **Transparent Issues**: Report errors immediately. No silent restores. Max 2 autonomous troubleshooting retries without user review.
5. **Relative Links**: Use relative paths (e.g. `[Worker](src/Worker.ts)`) in docs. No `file://`.
6. **Automatic Git Commits**: Run `scripts/agents/commit-changes.sh` immediately after valid edits.
7. **Docker-Centric Testing & Execution**: Test and execute all local scripts via `docker compose`. Distinguish testing/debugging from production verification:
   * **Debugging/Testing**: Always use volume mounting to synchronize source files in real-time (e.g., `docker compose -p scraper run --rm --user $(id -u):$(id -g) -v $(pwd):/app -v /app/node_modules worker npx ts-node src/...`). Do not use `docker cp`.
   * **Production/Verification**: When validating the final built image (production context), run without volume mounts (after rebuilding the image). Ensure scripts can access MongoDB/Redis within the Docker network context.
   * **Frontend Compilation & Deployment**: Rebuild the service image directly to compile and apply frontend changes (e.g., `docker compose build viewer` or `docker compose up -d --build viewer`), as the viewer service runs entirely within the isolated container context without host volume mounts.
   * **Local node_modules Mount Troubleshooting**: When mounting the workspace using `-v $(pwd):/app`, the host's `node_modules` will overwrite the container's version. To avoid library/dependency version mismatch (especially for tools like Playwright that require specific browser versions built into the image), add an anonymous volume mount for the node modules directory: `-v /app/node_modules`.
   * **Playwright Browser Mismatch**: If you encounter a `browserType.launch: Executable doesn't exist` error due to mismatching versions:
     - Rebuild the specific service image only to align dependency versions: `docker compose build worker`
     - Or temporarily install matching browsers in the container: `docker compose run --rm worker npx playwright install`
   * **No Host Port Exposure**: Do not expose infrastructure service ports (e.g., MongoDB `27017`, Redis `6379`, Meilisearch `7700`) directly to the host machine. All traffic must route through Traefik reverse proxy domains (e.g., `*.localhost`, `*.nip.io`).
   * **Docker-Internal CLI Operations**: Since infrastructure services (such as MongoDB, Redis, and Meilisearch) do not expose ports directly to the host machine, you MUST execute any CLI utilities, diagnostics, or REST actions (e.g., `curl` commands targeting them, database shell queries) inside the container network using `docker compose run` (e.g., `docker compose -p scraper run --rm worker curl -X DELETE http://meilisearch:7700/indexes/contents`). Never attempt direct host-to-localhost connection commands. CRITICAL: When executing network or API diagnostics (like `curl` commands) within the docker network, do not modify or install packages on base service containers; instead, use the network troubleshooting container `nicolaka/netshoot` (e.g., `docker compose -p scraper run --rm nicolaka/netshoot curl ...`).
8. **Transcripts Export (Manual Execution)**: Do not run `make agents-dump` automatically on session start. Defer transcript and session exports to the user, providing the command line only when requested or when summarizing session outcomes.
9. **No Unapproved Concurrent Background Tasks**: To prevent race conditions and database/system state corruption, the agent MUST NOT launch or run multiple background commands/tasks in parallel without explicit user approval for each command. Wait for any active background tasks to fully finish and verify their exit status before requesting permission for any subsequent commands.
10. **Defer Data Mutations to User**: To prevent unintended data corruption or conflict, the agent MUST NOT execute or request approval to run commands that perform major persistent data mutations, database seeding, index resetting, or reindexing (e.g. `meili-manager.ts --reset`). Instead, the agent must explain the required execution steps and command lines clearly in the chat, requesting that the USER run them manually.
11. **Collaborative Deferral of Environment Controls (Pair Programming)**: For operational task executions such as container rebuilds, service restarts, image cleaning, and complex runtime deployments, the agent should act as a collaborative pair programming partner. Instead of running these commands directly, the agent should prioritize explaining the purpose and command lines clearly, requesting that the USER run them (e.g. `make up-viewer` or custom docker build commands) manually.
12. **Korean Language for AI Processing & Responses**: All AI processing logs, status messages, and chat responses must be written in Korean.
13. **No Out-of-Scope Modifications**: Do not modify files outside the scope explicitly requested by the user.
14. **No Speculative Fixes**: Speculative or guessing-based code modifications are strictly prohibited. If the root cause of an issue is unknown, ask the user for clarification.


## ⚠️ Security Rules
- **No ENV Access**: DO NOT access `.env` or `.env.*` files. Use `.env.example` for reference.
- **No Credentials**: Never expose API keys/credentials in command outputs.

## ⚙️ Engineering & Architecture Rules

1. **Strict OOP Patterns**: Use classes, interfaces, and SOLID principles. Avoid loose utility functions for core logic.
2. **Strict Typing**: Avoid 'any' type. Declare explicit return types and interfaces for public methods.
3. **Robust Error Handling**: Never use empty catch blocks. Always log error contexts and close DB/Redis connections in finally blocks.
4. **Centralized Config**: Access 'process.env' ONLY within dedicated config files. Inject configuration via constructor.
5. **Agent-Friendly Docstrings**: Start every source, script, and automation file with a header docstring/comment detailing design context, constraints, and dependencies to prevent refactoring loops. Update it when behavior changes.
6. **No Superficial Patches**: Never implement superficial patches (e.g., custom regex exclusions or hardcoded parameters to hide symptoms) when errors occur. Always trace the data flow, investigate database/state coordination, find the true root cause, and implement a robust structural/architectural solution. **또한 버그가 수정(Bugfix)되었을 때에는 단순 변경사항과 엄격히 구분하여 CHANGELOG와 코드 리뷰 문서에 'Bugfix'임을 명확히 표기하고 기록해야 합니다.**

## 📝 Documentation Lifecycle Rules

에이전트는 모든 설계 및 기능 변경 작업을 수행할 때 아래의 **문서화 수명 주기(Documentation Lifecycle)**를 준수해야 합니다.

1. **문서화 수명 주기 순서**:
   $$\text{Spec (.spec.md)} \longrightarrow \text{Plan (.plan.md)} \longrightarrow \text{Review (.review.md + .task.md)} \longrightarrow \text{Walkthrough (.walkthrough.md)}$$
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

5. **아티팩트 Squash 정책**:
   - `make agents-squash`로 `.review.md` + `.task.md` + `.walkthrough.md` 3종을 `.summary.md` 1개로 압축 (토큰 ~66% 절약)
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

## 🔓 Pre-Approved Commands

The following commands/scripts are pre-approved and exempt from Rule 1's and Rule 2's consent loops:
- `git ls-files` (Read-only project codebase mapping to minimize token/API usage)
- `scripts/agents/commit-changes.sh` (Runs automatically after edits to save progress)
