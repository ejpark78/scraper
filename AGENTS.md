# 🤖 Agent Project Rules (AGENTS.md)

## ⚠️ Critical Constraints

1. **No Arbitrary Bash**:
   - Don't run observation commands (`ps`, `logs`, `mongosh` etc.) without user consent.
   - Compress multiple status checks into a single script.

2. **Strict Planning Mode**:
   - Don't modify code/containers without a plan and explicit approval.
   - **NEVER run destructive DB commands (Drop, Delete, overwrite, reset) without prior explicit consent.**
   - Summarize analysis and changes first; obtain user confirmation.

3. **Minimal File Scope**:
   - Avoid generic `grep` or `list_dir` on root. Perform `view_file` only on target files.

4. **Transparent Issues**:
   - Report unexpected errors/data loss immediately. Do NOT perform silent recovery/restore without approval.

5. **Relative Links**:
   - Use relative paths for markdown links (e.g. `[Worker](src/Worker.ts)`). No absolute `file://`.

6. **Symbolic Links for Artifacts**:
   - Automatically link created/modified artifacts to `.agents/brain/`.

7. **Automatic Git Commits**:
   - Whenever you modify code or configuration files, you must execute `.agents/scripts/commit-changes.sh` to automatically commit the changes.
   - Do this as soon as the modifications are validated or before transitioning to the next step to preserve context and reduce token usage.

## ⚠️ Security Rules
- **DO NOT** read, write, or access `.env` or `.env.*` files under any circumstances.
- Never expose API keys or credentials in terminal outputs (e.g., `cat`, `echo`).
- Use `.env.example` to reference env structure. Instruct users to update `.env` manually.
