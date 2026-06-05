# ==============================================================================
# 🌐 Playwright Browser Login & Session Control
# ==============================================================================

.PHONY: login open logout

login:
	npx ts-node src/crawler.ts login

open:
	npx ts-node src/browser/open.ts

logout:
	rm -f data/sessions/linkedin.json
	@echo "🔒 로그인 세션이 성공적으로 삭제되었습니다."
