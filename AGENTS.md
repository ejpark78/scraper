# 🤖 Antigravity Agent Work Guide (AGENTS.md)

## ⚠️ Critical Constraints (Token Saving & Execution Restrictions)

1. **No Arbitrary Bash Commands**:
   - Do not invoke observation commands (e.g., `ps`, `logs`, `mongosh` queries) repeatedly without explicit user consent.
   - When checking single pieces of information, compress the check into a single unified script execution or command instead of calling multiple tools.

2. **Strict Planning Mode**:
   - Do not perform actions with side-effects (e.g., changing code, restarting containers) before the user issues explicit execution instructions or when they simply ask to "check" something.
   - **Specifically, never execute any database command that has destructive impacts or risks of data loss (e.g., Drop, Delete, overwrite, restore reset) without the user's prior explicit consent and approval.**
   - First, summarize the cause analysis and expected changes in text to obtain user confirmation.

3. **Minimize File Search and Analysis Scope**:
   - Refrain from indiscriminate `grep` or `list_dir` across the entire project directory. Perform `view_file` only on specific files with clear relevance.

4. **Transparent Sharing of Issues & No Unauthorized Recovery**:
   - If unexpected errors, script malfunctions, or data loss occur during work, immediately share the situation transparently with the user instead of hiding it or trying to fix it unilaterally.
   - Never perform recovery actions (e.g., backup restore) unilaterally without explicit user approval. Report the solution, obtain confirmation, and then proceed with the steps.

5. **Use Relative Paths for Links and Code Symbols**:
   - When creating clickable markdown links for files and code symbols (classes, types, functions, structs), use **relative paths** instead of absolute paths starting with the `file://` scheme (e.g., `[ScraperWorker.ts](src/ScraperWorker.ts)`).

6. **Automatic Symbolic Links for Artifacts**:
   - When creating or modifying artifact files, automatically create or update a symbolic link to that artifact in the `.agents/brain/` folder at the project root directory, ensuring easy user access.
