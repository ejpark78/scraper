# 🤖 Agent Project Rules (AGENTS.md)

## ⚠️ Critical Constraints

1. **No Arbitrary Bash**: Consent required for ALL shell commands (including read-only diagnostics, git, docker, ls, env, etc.) except for those listed in Pre-Approved Commands. Present the exact command(s) to the user in the chat and obtain explicit approval before calling the run command tool. Compress multiple diagnostics/status checks into a single combined command execution (e.g. chaining with `&&`, `;`, or using `cat << 'EOF' | bash` with Korean comments for each command) to minimize user confirmation loops.
2. **Strict Planning**: Summarize plan and obtain user consent before any file writes or environment changes (except for commands listed in Pre-Approved Commands). Before requesting approval, present the target files and planned modifications in a Markdown table (with columns: File Path, Action, and Details) to ensure transparency. CRITICAL: You must NOT call any write or modification tools in the same turn you propose a plan; always end your turn and wait for consent first.
3. **Minimal File Scope**: No root grep/list_dir. Prefer a single `git ls-files` call to map tracked files efficiently and discover nested paths in one go to minimize API/token consumption, rather than making multiple step-by-step `list_dir` traversals. Use step-by-step `list_dir` only for untracked folders (e.g. `data/`) or fallback. Use view_file only on target files.
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

