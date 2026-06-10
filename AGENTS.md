# 🤖 Agent Project Rules (AGENTS.md)

## ⚠️ Critical Constraints

1. **No Arbitrary Bash**: Consent required for logs/ps/mongosh. Compress status checks.
2. **Strict Planning**: Summarize plan and obtain user consent before any file writes or environment changes (except for commands listed in Pre-Approved Commands). CRITICAL: You must NOT call any write or modification tools in the same turn you propose a plan; always end your turn and wait for consent first.

3. **Minimal File Scope**: No root grep/list_dir. Use view_file only on target files.
4. **Transparent Issues**: Report errors immediately. No silent restores. Do not exceed 2 autonomous troubleshooting retries without user review.
5. **Relative Links**: Use relative paths (e.g. `[Worker](src/Worker.ts)`) in docs. No `file://`.
6. **Symbolic Links for Artifacts**: Link created/modified artifacts to `.agents/brain/`.
7. **Automatic Git Commits**: Run `.agents/scripts/commit-changes.sh` immediately after valid edits.
8. **Docker-Centric Testing**: Test via `docker compose`. Prefer volume mounting (`-v`) with `run --rm` over `docker cp` for executing local scripts.

## ⚠️ Security Rules
- **No ENV Access**: DO NOT access `.env` or `.env.*` files. Use `.env.example` for reference.
- **No Credentials**: Never expose API keys/credentials in command outputs.

## ⚙️ Engineering & Architecture Rules

1. **Strict OOP Patterns**: Use classes, interfaces, and SOLID principles. Avoid loose utility functions for core logic.
2. **Strict Typing**: Avoid using 'any' type. Declare explicit return types and interfaces for public methods.
3. **Robust Error Handling**: Never use empty catch blocks. Always log error contexts and close DB/Redis connections in finally blocks.
4. **Centralized Config**: Access 'process.env' only within dedicated config files. Inject configuration via constructor.
5. **Agent-Friendly Docstrings**: Start every source file with a JSDoc (or file-type appropriate comment block for non-JS/TS files) detailing design context, constraints, and dependencies to prevent agent refactoring loops. Automatically update this header docstring whenever modifying the code's behavior.


## 🔓 Pre-Approved Commands
The following commands/scripts are pre-approved and exempt from Rule 2's consent loop:
- `.agents/scripts/commit-changes.sh` (Runs automatically after edits to save progress)

