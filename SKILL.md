# 🗺️ Global Meta Skill & Project Architecture (SKILL.md)

This document serves as the **Global Meta Skill** for AI coding agents working on the LinkedIn Clipper project. It coordinates domain-specific skills, defines the overall project architecture, and enforces execution boundaries.

---

## 1. 📂 Agent Skill Directory Map

When taking on a task, identify the developmental context and activate/reference the corresponding skill file:

| Development Context | Target Skill File | Key Rules & Focus |
|:---|:---|:---|
| **Site Crawlers & Pipeline** | [.agents/skills/develop_sites_skills.md](file:///.agents/skills/develop_sites_skills.md) | Bronze ➡️ Silver pipeline stages, extending base classes, `IConverter` implementation, saving DB connections in `finally` blocks. |
| **Database & Indices** | [.agents/skills/database_skills.md](file:///.agents/skills/database_skills.md) | MongoDB & Redis schema rules, mandatory database indexes, query performance, and indexing standards. |
| **HTML/Scraping Debugging** | [.agents/skills/html_debugging_skills.md](file:///.agents/skills/html_debugging_skills.md) | Using `HtmlDebugger` utility, dumping raw vs minified HTML, and troubleshooting extraction issues. |
| **Global Environment & Orchestration** | **This Document (`SKILL.md`)** | Orchestrating services, Docker networks, CLI diagnostics, testing workflows, and general agent behavior. |

---

## 2. 🏗️ Global System Architecture

The Clipper application relies on a microservice-style infrastructure orchestrated via Docker Compose.

```mermaid
graph TD
    subgraph Host Network
        Traefik[Traefik Reverse Proxy]
    end
    subgraph Docker Network: scraper-net
        Scraper[Scraper Worker]
        Converter[Converter Worker]
        Viewer[Viewer Frontend & Server]
        Mongo[(MongoDB)]
        Redis[(Redis)]
        Meili[(Meilisearch)]
        Cronicle[Cronicle Scheduler]
    end

    Traefik -->|Proxy Domain Routing| Viewer
    Traefik -->|Proxy Domain Routing| Cronicle
    Scraper -->|Read/Write HTML & Status| Mongo
    Scraper -->|Queue Management| Redis
    Converter -->|Read HTML| Mongo
    Converter -->|Write Contents| Mongo
    Converter -->|Queue Management| Redis
    Viewer -->|Fetch Data| Mongo
    Viewer -->|Search Contents| Meili
```

### 2.1 Domain-Based Host Routing (Traefik)
- Infrastructure services (MongoDB, Redis, Meilisearch) **must not expose ports directly to the host machine**.
- Traffic to user-facing dashboards (Viewer, Cronicle) is routed through Traefik using custom local hostnames (e.g., `*.localhost` or `*.nip.io`).

---

## 3. ⚙️ Execution & Testing Workflows (Strict Rules)

To ensure consistency and avoid library or runtime mismatches (especially for browser-based automation tools like Playwright):

### 3.1 Docker-Centric Development & Debugging
- **Never** run scraping or transformation scripts directly on the host. Always run them inside containers with volume mounting:
  ```bash
  docker compose -p scraper run --rm --user $(id -u):$(id -g) -v $(pwd):/app -v /app/node_modules worker npx ts-node src/crawler/cli-list.ts --site geeknews
  ```
- **Volume Mount Guideline**: When mounting the workspace (`-v $(pwd):/app`), the host's `node_modules` must not overwrite the container's version. Always append `-v /app/node_modules` to preserve the container's built dependencies.

### 3.2 Testing Environments
- **Unit/Integration Tests**: Run using the testing compose environment to isolate DB/Redis states.
- **Production Verification**: When validating production images, run **without** volume mounts after triggering a rebuild:
  ```bash
  docker compose build worker && docker compose run --rm worker npm test
  ```

---

## 4. 📝 Code Quality & Integrity Principles

Every code change must adhere to the following strict engineering guidelines:

1. **Explicit Typing (No `any`)**: Declare explicit TypeScript interfaces and return types for all public and internal methods.
2. **Resource & Lifecycle Management**: Database connections, browser pools, and file handles must always be closed inside a `finally` block to prevent leaks and process hangs.
3. **No Silent Failures**: Every `catch` block must log the error context using a dedicated logging utility (like `Logger.warn`).
4. **Centralized Config**: Never reference `process.env` directly in application logic. Inject configurations via the `AppConfig` class constructor.
5. **Git Commit Automation**: After making valid modifications, always run `scripts/agents/commit-changes.sh` immediately to record progress.

---

## 🔄 5. AI-Assisted Coding SDLC Lifecycle Workflow

에이전트는 단순히 프롬프트 기반으로 코드를 Speculate(추측)하여 작성하는 **Vibe Coding**을 엄격히 배제하며, 아래의 엔지니어링 생명 주기를 필수 준수합니다.

```text
기획 (PRD/요구사항) ➡️ 설계 (Specs/ADR) ➡️ 계획 (Plans) ➡️ 검증 (Tests) ➡️ 배포 (Prod)
```

1. **요구사항 확인**: 사용자가 제시한 기획 의도(PRD)를 파악합니다. 필요 시 대화를 통해 기획안을 구체화하고 [prd_template.md](file:///home/ejpark/workspace/scraper/docs/templates/prd_template.md) 양식에 맞춰 요구 사양을 먼저 역작성하여 합의하는 프로세스를 가질 수 있습니다.
2. **사양 및 기술 결정 (Specs/ADR)**:
   - 구현 전, [docs/specs/](file:///home/ejpark/workspace/scraper/docs/specs/)에 데이터 입출력 명세와 파이프라인 명세를 작성합니다.
   - 구조적 설계 분기가 있을 경우 [docs/adr/](file:///home/ejpark/workspace/scraper/docs/adr/)에 비교 근거를 기록합니다.
3. **구현 계획 수립 (Plans)**:
   - [docs/plans/](file:///home/ejpark/workspace/scraper/docs/plans/) 하위에 구체적으로 생성/수정할 파일들과 CLI 테스트 명령어 계획을 작성하여 **사용자의 승인**을 받습니다.
4. **검증 (Tests)**:
   - [docs/tests/](file:///home/ejpark/workspace/scraper/docs/tests/)에 수동/자동 테스트 시나리오를 설계하고 실제 통과 결과를 [docs/reviews/](file:///home/ejpark/workspace/scraper/docs/reviews/) 리포트에 기록하여 검증을 완료합니다.

