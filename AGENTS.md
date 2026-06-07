# 🤖 Antigravity Agent Work Guide (AGENTS.md)

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
