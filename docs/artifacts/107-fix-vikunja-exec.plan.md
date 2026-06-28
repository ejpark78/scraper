# Plan - Fix Vikunja Container Shell and Curl Dependency Errors

This plan solves the missing shell (`/bin/sh`, `/bin/bash`) and missing shared library dependency errors (`libunistring.so.5` etc. for `curl`) in the Vikunja tool container, and automatically sets up a default user on container startup.

## Proposed Changes

### 🛠️ [docker/tools/vikunja](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja)

#### [MODIFY] [Dockerfile](file:///Users/ejpark/workspace/scraper/docker/tools/vikunja/Dockerfile) (Completed)
Changed the build strategy to Alpine base with official binary copies.

### 🛠️ [scripts/tools](file:///Users/ejpark/workspace/scraper/scripts/tools)

#### [MODIFY] [tools.mk](file:///Users/ejpark/workspace/scraper/scripts/tools/tools.mk)
Correct the admin promotion command to use `user set-admin vikunja-admin --admin` instead of the non-existent `user promote --email`.
```makefile
up-vikunja:
	$(COMPOSE) --profile tools up -d vikunja
	@echo "⏳ Vikunja 컨테이너가 안정화될 때까지 대기합니다..."
	@sleep 5
	@if ! $(COMPOSE) exec -T -u 1000 vikunja /app/vikunja/vikunja user list | grep -q "vikunja-admin"; then \
		echo "⚙️ Vikunja 초기 관리자(vikunja-admin) 계정을 생성합니다..."; \
		$(COMPOSE) exec -T -u 1000 vikunja /app/vikunja/vikunja user create --email admin@example.com --username vikunja-admin --password admin12345 || true; \
		$(COMPOSE) exec -T -u 1000 vikunja /app/vikunja/vikunja user set-admin vikunja-admin --admin || true; \
	fi
	@echo "🚀 Vikunja GUI가 실행되었습니다. https://vikunja.localhost 에 접속하세요."
```

---

## Verification Plan

### Automated / Manual Verification
1. Re-create and start the Vikunja container:
   ```bash
   make up-vikunja
   ```
2. Verify shell and user creation.
