## 📋 Execution & Review Planning Rule

This rule is activated and applied **only** when the user explicitly requests a plan by saying **"plan this"**, **"make a plan"**, or equivalent planning requests. (For general instructions or simple tasks, perform the physical work immediately without going through a planning stage.)

1. **Archive Existing Plan on Review Approval or New Plan Request**:
   * Immediately after the user agrees to/approves the previous completion review (`./.agents/reviews.md`), or at the moment a new planning request flows in, move (archive) the following files located in the root directory to the backup folder to preserve the trace of previous work:
     * Target files: `./.agents/plan.md`, `./.agents/action_items.md`, `./.agents/reviews.md`
     * Target path: `./.agents/tasks/{4-digit number}-YYYY-MM-DDTHHMMSS/` (Create a directory using the next 4-digit sequence following the previous task folder, combined with the current timestamp, and move the files there.)

2. **Create Plan and Action Items Files**:
   * Upon receiving a planning request, the agent must create the following two files **before** actually executing the task (e.g., modifying code, running commands):
     * **`./.agents/plan.md`**: A comprehensive project plan detailing the task objectives, analysis results, step-by-step implementation scenarios, and validation plans.
     * **`./.agents/action_items.md`**: A checklist document (To-Do List) showing detailed implementation tasks and their progress status.
   * **Natural Korean Writing Principle**:
     * Write `plan.md`, `action_items.md`, and `reviews.md` in natural, highly detailed Korean, avoiding unnatural translated phrasing.

3. **User Review and Approval**:
   * After writing the above files, the agent must request the user's review of the plan and action items checklist. The agent can proceed with actual physical tasks (code modifications, deletions, terminal executions, etc.) only after the user reviews and approves them (e.g., by clicking 'Proceed' or giving approval).

4. **Execution Completion and Review Request**:
   * Once the task implementation and validation are completed according to the approved plan, the agent must generate a final **`./.agents/reviews.md`** file to report task completion and self-validation results, and request a final review from the user.
     * This review document must also be written in natural, highly readable Korean to clearly communicate all changes in the main work.
