# 🤖 Agent Project Rules (AGENTS.md)

## ⚠️ Critical Constraints

1. **No Arbitrary Bash**: Consent required for ALL shell commands (except Pre-Approved). Present the exact command in chat for explicit approval first. Compress multiple checks into a single chained execution to minimize confirmation loops.
2. **Strict Planning**: Propose a plan in a Markdown table (Columns: File Path, Action, Details) and obtain consent before file writes or env changes (except Pre-Approved). CRITICAL: Wait for consent before calling any write/modification tools.
3. **Minimal File Scope**: No root grep/list_dir. Use a single `git ls-files` call to map tracked paths and nested folders in one go to save API/tokens. Use `list_dir` only for untracked paths (e.g. `data/`) or fallback. Use `view_file` only on target files.
4. **Transparent Issues**: Report errors immediately. No silent restores. Do not exceed 2 autonomous troubleshooting retries without user review.
5. **Relative Links**: Use relative paths (e.g. `[Worker](src/Worker.ts)`) in docs. No `file://`.
6. **Automatic Git Commits**: Run `.agents/scripts/commit-changes.sh` immediately after valid edits.
7. **Docker-Centric Testing & Execution**: Test and execute all local scripts via `docker compose` (e.g., `docker compose run --rm`). Prefer volume mounting (`-v`) over `docker cp` for executing local scripts.
8. **Transcripts Export on Start**: At the very beginning of a session (the first turn of a new or resumed session) only, the agent must run `make -f .agents/Makefile dump-all AGENTS=agy` to dump and validate all transcripts and context summaries. It is not required to run this when finalizing or exiting.

## ⚠️ Security Rules
- **No ENV Access**: DO NOT access `.env` or `.env.*` files. Use `.env.example` for reference.
- **No Credentials**: Never expose API keys/credentials in command outputs.

## ⚙️ Engineering & Architecture Rules

1. **Strict OOP Patterns**: Use classes, interfaces, and SOLID principles. Avoid loose utility functions for core logic.
2. **Strict Typing**: Avoid using 'any' type. Declare explicit return types and interfaces for public methods.
3. **Robust Error Handling**: Never use empty catch blocks. Always log error contexts and close DB/Redis connections in finally blocks.
4. **Centralized Config**: Access 'process.env' only within dedicated config files. Inject configuration via constructor.
5. **Agent-Friendly Docstrings**: Start every source, script, and automation file (including src/, .agents/, and scripts/) with a JSDoc (or file-type appropriate comment block for non-JS/TS files) detailing design context, constraints, and dependencies to prevent agent refactoring loops. Automatically update this header docstring whenever modifying the code's behavior.


## 🔓 Pre-Approved Commands
The following commands/scripts are pre-approved and exempt from Rule 1's and Rule 2's consent loops:
- `git ls-files` (Read-only project codebase mapping to minimize token/API usage)
- `.agents/scripts/commit-changes.sh` (Runs automatically after edits to save progress)
- `make -f .agents/Makefile dump-all AGENTS=agy` (Runs on session start to generate/export session reports)

