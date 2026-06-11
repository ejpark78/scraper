# 🤖 Agent Project Rules (AGENTS.md)

## ⚠️ Critical Constraints

1. **No Arbitrary Bash**: Consent required for ALL shell commands (including read-only diagnostics, git, docker, ls, env, etc.) except for Pre-Approved Commands. Present the exact command in chat for explicit approval first. Compress multiple diagnostics/status checks into a single chained execution (e.g. chaining with `&&`, `;`, or using `cat << 'EOF' | bash`) to minimize user confirmation loops.
2. **Strict Planning**: Propose a plan in a Markdown table (Columns: File Path, Action, Details) and obtain consent before file writes or env changes (except Pre-Approved). CRITICAL: You must NOT call any write or modification tools in the same turn you propose a plan; always end your turn and wait for consent first.
3. **Minimal File Scope & Coverage**: Do not use root-level grep or recursive list_dir.
   * To map the project structure without missing nested folders, run a single `git ls-files` call once.
   * Pinpoint the exact target file path using the map, then use `view_file` to read it directly.
   * If searching for code symbols across multiple files, use `grep_search` to pinpoint the matching line numbers instead of reading files one-by-one, minimizing API/token consumption while maintaining full coverage.
4. **Transparent Issues**: Report errors immediately. No silent restores. Max 2 autonomous troubleshooting retries without user review.
5. **Relative Links**: Use relative paths (e.g. `[Worker](src/Worker.ts)`) in docs. No `file://`.
6. **Automatic Git Commits**: Run `.agents/scripts/commit-changes.sh` immediately after valid edits.
7. **Docker-Centric Testing & Execution**: Test and execute all local scripts via `docker compose` (e.g., `docker compose -p linkedin run --rm --user $(id -u):$(id -g) -v $(pwd):/app -v /app/node_modules base npx ts-node src/...`). Use volume mounting to synchronize source files and bypass rebuilding, ensuring scripts can access MongoDB/Redis within the Docker network context. Do not use `docker cp` for local script execution.
   * **Local node_modules Mount Troubleshooting**: When mounting the workspace using `-v $(pwd):/app`, the host's `node_modules` will overwrite the container's version. To avoid library/dependency version mismatch (especially for tools like Playwright that require specific browser versions built into the image), add an anonymous volume mount for the node modules directory: `-v /app/node_modules`.
   * **Playwright Browser Mismatch**: If you encounter a `browserType.launch: Executable doesn't exist` error due to mismatching versions:
     - Rebuild the specific service image only to align dependency versions: `docker compose build base`
     - Or temporarily install matching browsers in the container: `docker compose run --rm base npx playwright install`
8. **Transcripts Export on Start**: Run `make -f .agents/Makefile dump-all AGENTS=agy` ONLY on the first turn of a new or resumed session (do not run when exiting/finalizing).

## ⚠️ Security Rules
- **No ENV Access**: DO NOT access `.env` or `.env.*` files. Use `.env.example` for reference.
- **No Credentials**: Never expose API keys/credentials in command outputs.

## ⚙️ Engineering & Architecture Rules

1. **Strict OOP Patterns**: Use classes, interfaces, and SOLID principles. Avoid loose utility functions for core logic.
2. **Strict Typing**: Avoid 'any' type. Declare explicit return types and interfaces for public methods.
3. **Robust Error Handling**: Never use empty catch blocks. Always log error contexts and close DB/Redis connections in finally blocks.
4. **Centralized Config**: Access 'process.env' ONLY within dedicated config files. Inject configuration via constructor.
5. **Agent-Friendly Docstrings**: Start every source, script, and automation file with a header docstring/comment detailing design context, constraints, and dependencies to prevent refactoring loops. Update it when behavior changes.

## 🔓 Pre-Approved Commands
The following commands/scripts are pre-approved and exempt from Rule 1's and Rule 2's consent loops:
- `git ls-files` (Read-only project codebase mapping to minimize token/API usage)
- `.agents/scripts/commit-changes.sh` (Runs automatically after edits to save progress)
- `make -f .agents/Makefile dump-all AGENTS=agy` (Runs on session start to generate/export session reports)


