## 🧠 Brain Dump Generation Rule (BrainDumpRule.md)

This document defines the schema, contents, and triggers for dumping the agent's complete interaction timeline, tools usage, and session health into a persistent analysis file. This allows users to inspect the detailed execution footprints of the agent.

---

### 1. Save Target and Location
* File Path: **`./data/agents/{ConversationID}/brain_dump.md`**
* Update Policy: When `dump-brain` is executed, analyze the session's execution history (`transcript_full.jsonl`) and generate or overwrite the file.
* **Language Requirement**: Summaries and descriptions within the brain dump should be descriptive and readable, focusing on exact tool metrics.

---

### 2. Brain Dump Content Structure
The `./data/agents/{ConversationID}/brain_dump.md` file must adhere to the following structure:

```markdown
# 🧠 Brain Dump (Session: {{CONVERSATION_ID}})
- **Dumped Date**: {{DATETIME}}
- **Total Turns**: {{TOTAL_TURNS}}
- **Total Tool/Command Calls**: {{TOTAL_TOOL_CALLS}}

## 📊 Tool Usage Summary
- **{{TOOL_NAME}}**: {{COUNT}} times
...

## 💬 Conversation Summary Timeline
* **[Step {{STEP_INDEX}}] {{ROLE}}**: {{TRUNCATED_CONTENT}}
```

---

### 3. Metric and Timeline Specification
* `{{CONVERSATION_ID}}`: The unique ID of the session being dumped.
* `{{DATETIME}}`: Local timezone (KST) date and time when the dump was performed.
* `{{TOTAL_TURNS}}`: Count of user input turns in the session.
* `{{TOTAL_TOOL_CALLS}}`: Total count of tool and command executions.
* `{{TOOL_NAME}}`: Name of the tool or command executed.
* `{{STEP_INDEX}}`: Step identifier in the JSONL transcript sequence.
* `{{ROLE}}`: Either `🗣️ User` or `🤖 Agent`.
* `{{TRUNCATED_CONTENT}}`: The text content of the message, truncated to 300 characters for readability and single-line formatted (replacing newlines with spaces).
