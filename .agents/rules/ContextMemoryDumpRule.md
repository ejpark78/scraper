## 🧠 Context Memory Dump Rule (ContextMemoryDump.md)

This document defines the schema, rules, and triggers for dumping the agent's current workspace context, environment states, and critical constraints into a persistent memory file. This ensures session continuity and prevents state loss across agent restarts or context flushes.

---

### 1. Save Target and Location
* File Path: **`./data/agents/{ConversationID}/context_memory.md`**
* Update Policy: Whenever a major structural change occurs or at the explicit request of the user, overwrite this file with the latest state snapshot.
* **Language Requirement**: The generated memory file (`context_memory.md`) must be written in natural, detailed Korean, avoiding unnatural translated phrasing.

---

### 2. Context Memory Template
The `./data/agents/{ConversationID}/context_memory.md` file must adhere to the following markdown structure:

```markdown
# 🧠 Workspace Context Memory Snapshot
- **Last Dumped Date**: {{DATETIME}}
- **Active Session ID**: {{CONVERSATION_ID}}

## ⚙️ Active Configurations & Environments
- **Redis URL**: `{{REDIS_URL}}`
- **MongoDB Connection Status**: `{{MONGO_STATUS}}`
- **Scraper Instances (Scale)**: `{{SCRAPER_SCALE}}`

## 📊 Site Specific States
- **LinkedIn Config**: {{LINKEDIN_STATE}}
- **GeekNews Config**: {{GEEKNEWS_STATE}}
- **GPTERS Config**: {{GPTERS_STATE}}
- **PyTorch KR Config**: {{PYTORCH_STATE}}

## 🚨 Critical Constraints & Rate Limits
- {{CONSTRAINTS}}

## 🗺️ Execution Roadmap & Next Steps
- [ ] {{ROADMAP_ITEMS}}
```

---

### 3. Placeholder Specification
* `{{DATETIME}}`: Current UTC date and time in `YYYY-MM-DD HH:MM:SS` format.
* `{{CONVERSATION_ID}}`: The unique ID of the current active session.
* `{{REDIS_URL}}`: Redis connection string currently used (e.g., `redis://redis:6379`).
* `{{MONGO_STATUS}}`: The status of the MongoDB instance connection.
* `{{SCRAPER_SCALE}}`: The scaling factor of scraper workers (configured via `SCALE` in Makefile/pipeline.mk).
* `{{LINKEDIN_STATE}} / {{GEEKNEWS_STATE}} / ...`: Active configurations for each target crawler, including scraping intervals or status.
* `{{CONSTRAINTS}}`: Active constraints retrieved from `AGENTS.md` and live execution warnings (e.g., rate limits, cookie sessions).
* `{{ROADMAP_ITEMS}}`: Remaining task checklists to be executed in this context.
