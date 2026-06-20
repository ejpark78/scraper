# 🤖 Agent Project Rules (AGENTS.md)

## ⚠️ Critical Constraints

1. **No Arbitrary Bash**: Consent required for ALL shell commands (including read-only diagnostics, git, docker, ls, env, etc.) except for Pre-Approved Commands. Present the exact command in chat for explicit approval first. Compress multiple diagnostics/status checks into a single chained execution (e.g. chaining with `&&`, `;`, or using `cat << 'EOF' | bash`) to minimize user confirmation loops.
2. **Strict Planning**: Propose a plan in a Markdown table (Columns: File Path, Action, Details) and obtain consent before file writes or env changes (except Pre-Approved). All design and migration plans must be documented in the 'docs/artifacts/' directory under a specific filename and approved by the user. CRITICAL: You must NOT call any write or modification tools in the same turn you propose a plan; always end your turn and wait for consent first. You must verify that the consent is explicitly granted by the human USER in a chat message. Do NOT interpret automated system notifications, background task completions, or other system-generated events as user consent to proceed.
3. **Minimal File Scope & Coverage**: Do not use root-level grep or recursive list_dir.
   * To map the project structure without missing nested folders, run a single `git ls-files` call once.
   * Pinpoint the exact target file path using the map, then use `view_file` to read it directly.
   * If searching for code symbols across multiple files, use `grep_search` to pinpoint the matching line numbers instead of reading files one-by-one, minimizing API/token consumption while maintaining full coverage.
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
   $$\text{PRD (요구정의)} \longrightarrow \text{Specs (명세)} \longrightarrow \text{ADR (의사결정)} \longrightarrow \text{Plans (계획)} \longrightarrow \text{Code / Reviews (코드/리뷰)} \longrightarrow \text{Walkthrough (결과보고)}$$

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

3. **코드 리뷰 작성 강제 및 자가 검증**:
    - 코드(Makefile, Dockerfile 등 설정 파일 포함) 수정이 수반되면 반드시 `docs/artifacts/` 하위에 3자리 순차 번호 및 접미사 규칙에 맞춘 리뷰 문서(`.review.md`), 할 일 목록(`.task.md`), 결과보고서(`.walkthrough.md`)를 세트로 작성하여 커밋해야 합니다.
    - 에이전트는 작업을 마치고 완료를 보고하기 전에 **"코드를 수정해두고 docs/artifacts 하위에 번호 및 접미사 규칙에 맞게 리뷰 세트 문서를 누락하지 않았는지"** 반드시 되돌아보는 자가 검증 루프(Self-Inspection)를 돌려야 합니다. 리뷰 작성이 누락된 상태에서는 최종 Done 보고를 할 수 없습니다.



## 🔓 Pre-Approved Commands
The following commands/scripts are pre-approved and exempt from Rule 1's and Rule 2's consent loops:
- `git ls-files` (Read-only project codebase mapping to minimize token/API usage)
- `scripts/agents/commit-changes.sh` (Runs automatically after edits to save progress)
