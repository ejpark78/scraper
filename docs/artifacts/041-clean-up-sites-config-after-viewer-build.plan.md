# 📋 Plan: Clean Up Sites Configuration After Viewer Build

이 계획은 `make viewer-build` 완료 직후 호스트 환경에 잔재해 있는 정적 설정 파일(`apps/viewer/config/sites.json`)을 자동으로 삭제하여, 크롤러와의 사이트 정보 불일치(Sync-out) 문제를 원천 예방하는 계획입니다.

## 1. 문제 분석
- `viewer` 서비스의 빌드를 위해 임시로 생성한 `sites.json` 설정 파일이 빌드 후에도 호스트 상에 계속 남아 방치되는 경우, 크롤러 설정이 수정되었을 때 최신화가 누락되어 뷰어와 정보 불일치가 유발될 위험이 있습니다.
- 빌드가 완료되어 이미 도커 이미지 내부에 탑재된 시점에서는 호스트 상의 파일이 더 이상 불필요합니다.
- 따라서 빌드 완료 즉시 호스트 상의 `apps/viewer/config/sites.json` 파일을 자동으로 깨끗이 삭제하도록 빌드 라이프사이클을 보완합니다.

## 2. 해결 방안
- `apps/viewer/Makefile`의 `build` 타겟 명령어 목록 하단에 삭제 명령어(`rm -f`)를 추가하여 빌드 완료 후 자동으로 청소가 수행되도록 합니다.

## 3. 작업 계획

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/viewer/Makefile` | Modify | `build` 타겟 명령어 실행 완료 직후 `apps/viewer/config/sites.json` 을 강제 삭제하는 로직 추가 |

## 4. 변경 예정 코드 상세

### `apps/viewer/Makefile` (변경 후)
```makefile
build:
	@echo "⚙️  Generating static sites configuration..."
	$(COMPOSE) run --rm -v $(ROOT_DIR):/app worker npx ts-node apps/crawler/src/scripts/generate-sites-config.ts
	$(COMPOSE) build --no-cache viewer-fe viewer-api viewer-mcp
	@rm -f $(ROOT_DIR)/apps/viewer/config/sites.json
	@echo "🚀 Viewer Build가 완료되었습니다."
```
