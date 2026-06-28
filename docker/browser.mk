# ==============================================================================
# 🌐 Playwright Browser Login & Session Control
# ==============================================================================

.PHONY: login open logout

SITE ?= linkedin

login:
	SITE=$(SITE) npx ts-node apps/crawler/src/sites/linkedin/Crawler.ts login

open:
	SITE=$(SITE) npx ts-node apps/crawler/src/tools/browser/open.ts

inspect-layout:
	npx ts-node apps/crawler/src/scripts/inspect-layout.ts

logout:
	rm -f data/sessions/$(SITE).json
	@echo "🔒 로그인 세션($(SITE).json)이 성공적으로 삭제되었습니다."
