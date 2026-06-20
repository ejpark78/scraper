# 📋 Plan: Automate Sites Configuration Generation in Viewer Makefile

이 계획은 `make viewer-build` 실행 시 사이트 메타데이터(`config/sites.json`) 생성을 자동화하여 수동 작업 누락으로 인한 404 인덱스 에러 재발을 방지하는 계획입니다.

## 1. 문제 분석
- `viewer` 서비스 빌드 전에 정적 사이트 메타데이터 `config/sites.json`이 항상 최신 상태로 갱신되어 있어야 합니다.
- 수동으로 스크립트를 구동하는 방식은 갱신을 잊어버리는 등의 휴먼 에러를 유발하기 쉽습니다.
- 따라서 `apps/viewer/Makefile`의 `build` 타겟이 시작될 때 컨테이너를 통해 메타데이터 빌드를 선행 가동하도록 개선합니다.

## 2. 해결 방안
- `apps/viewer/Makefile`의 `build` 명령어 실행 전에 `docker compose`를 활용하여 `generate-sites-config.ts`를 실행하는 커맨드를 내장시킵니다.

## 3. 작업 계획

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/viewer/Makefile` | Modify | `build` 타겟 실행 명령어 목록 최상단에 `generate-sites-config.ts` 구동 로직 추가 |

## 4. 변경 예정 코드 상세

### `apps/viewer/Makefile` (변경 전)
```makefile
build:
	$(COMPOSE) build --no-cache viewer-fe viewer-api viewer-mcp
	@echo "🚀 Viewer Build가 완료되었습니다."
```

### `apps/viewer/Makefile` (변경 후)
```makefile
build:
	@echo "⚙️  Generating static sites configuration..."
	$(COMPOSE) run --rm -v $(ROOT_DIR):/app worker npx ts-node apps/crawler/src/scripts/generate-sites-config.ts
	$(COMPOSE) build --no-cache viewer-fe viewer-api viewer-mcp
	@echo "🚀 Viewer Build가 완료되었습니다."
```
