# Code Review Checklist (AI & Human Pair Programming)

Before merging any pull request or committing changes, verify the implementation against these safety and quality checks.

---

## 1. Safety & Infrastructure Checks
- [ ] **No Host Port Access**: All database/Redis/Meilisearch connections route internally inside the docker network. No direct host-port exposures.
- [ ] **Docker Network Usage**: Command diagnostics target internal services (e.g. `mongodb:27017`) through `docker compose run` and netshoot helpers.
- [ ] **Connection Leak Prevention**: All DB clients and Redis handles are quit/closed in `finally` blocks.
- [ ] **Credentials Safe**: Ensure no secrets, `.env` file contents, or API keys are printed in stdout or stored in config files.

---

## 2. Engineering & OOP Patterns
- [ ] **Strict Typing**: The `any` type is avoided. Explicit return types and interfaces are used for all public/module exports.
- [ ] **Strict OOP Principles**: Standard Solid principles are met. Dedicated service classes are used instead of loose/inline script functions.
- [ ] **Centralized Config**: `process.env` is accessed exclusively within `src/config/AppConfig.ts` and injected into service constructors.
- [ ] **Docstrings**: Headers describing module context, constraints, and dependencies are updated or appended at the top of modified files.

---

## 3. ID and Cache Constraints
- [ ] **Unified Redis Namespace**: No custom queue strings. Queues match `sites:${siteKey}:scrape:${priority}` and cache sets match `sites:${siteKey}:completed`.
- [ ] **Fixed Length IDs**: Document IDs are unique and fixed-length (MD5 or equivalent), avoiding URL parameter length errors.
- [ ] **Migration Safety**: If ID mapping algorithm changes, MongoDB records are migrated using migration scripts before deploying.

---

## 4. Data Migration & Retroactive Recovery Checks
- [ ] **State Restoration**: Verify that recovering documents sets `status: 'new'` and `pushedToRedis: false` to allow re-crawling.
- [ ] **Collisions Avoided**: Confirm that migration script checks if the target clean ID already exists before attempting upsert.
- [ ] **Dry Run Validation**: Scripts performing data mutations support dry-run outputs or are thoroughly run in test database profiles.
