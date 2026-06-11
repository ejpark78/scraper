## 📚 LLM Wiki-Based Unified Log & Transcript Rule

To maximize reliability, reproducibility, and knowledge accumulation for the LLM, record the entire execution history and conversation transcripts of a session into a single, unified file.

1. **Target and Location for Unified Recording**:
   * The agent must record the user's raw request, the agent's exact final response (do not summarize or truncate), and all executed CLI commands without omission.
   * Save the entire session's transcript into a single file named after the Conversation ID: **`./data/agents/{ConversationID}.md`** (e.g., `11b49df4-0bde-4273-bb19-0fa2c8546755.md`).
   * When a new turn occurs, append the turn log to the end of this file, separating each turn with a clear markdown horizontal divider: `---`.
   * **No Omission of Previous Turns**: Do not delete, truncate, or summarize previous turns when appending a new one. The file must act as a complete, chronological log of all turns in the session.

2. **Log Format Template (LLM Wiki Template)**:
   * Write each turn section within the session file complying with the following markdown structure:

   ```markdown
   # 📌 Turn: [{{CATEGORY}}] {{SUMMARY}}
   - **Tags**: {{TAGS}}
   - **Related Files**: {{FILES}}
   - **Date**: {{DATETIME}}
   
   ## 🗣️ User Request
   > {{REQUEST}}
   
   ## 🗣️ Agent Answer
   > {{ANSWER}}

   ## 🛠️ Action Taken & Implementation Details
   - {{IMPLEMENTATION}}
   
   ### 💻 Executed CLI Commands
   - {{COMMANDS}}
   
   ## 💡 Troubleshooting / Learnings (LLM Knowledge Base)
   - {{LEARNINGS}}
   ```

   * **Placeholder Specification**:
     * `{{CATEGORY}}`: Functional category of the turn (e.g., `Doc/Rules`, `Refactor`, `DB/Migration`).
     * `{{SUMMARY}}`: A brief, clear summary of the turn.
     * `{{TAGS}}`: Hashtags representing the topic (e.g., `#relative-path`, `#wiki-layout`).
     * `{{FILES}}`: Bulleted list of clickable markdown links using **relative paths** to related files.
     * `{{DATETIME}}`: Current date and time in `YYYY-MM-DD HH:MM:SS` format.
     * `{{REQUEST}}`: Raw text of the user's request.
     * `{{ANSWER}}`: Exact, full-length final answer sent by the agent to the user (never summarized or truncated).
     * `{{IMPLEMENTATION}}`: Detailed summary of changes made by the agent.
     * `{{COMMANDS}}`: List of executed CLI commands (in `[timestamp] command` format). If bash commands were executed, you MUST record the exact commands that were run. If no bash commands were executed, document the core agent tool calls used for the task (e.g., `[timestamp] replace_file_content on path/to/file`) to explain how the work was done.
     * `{{LEARNINGS}}`: Error troubleshooting steps, technical challenges resolved, or accumulated knowledge.
