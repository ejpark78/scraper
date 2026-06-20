# 📋 Plan: Fix Meilisearch & MongoDB Makefile Scripts Paths

이 계획은 `make ms-reindex` 등 Meilisearch 및 MongoDB 관리 명령어 실행 시 컨테이너 내부 경로 구조가 불일치하여 스크립트를 찾지 못하던 현상(Bugfix) 및 009 작업의 누락 항목(WORKSPACE_MOUNT 잔재)을 수정하기 위한 계획입니다.

## 1. 문제 분석
- `worker` 컨테이너 빌드 시 컨텍스트는 `apps/crawler` 이므로 컨테이너 내부의 `/app` 에는 `apps/crawler` 폴더가 존재하지 않고, `src/scripts/meili-manager.ts` 처럼 바로 하위에 존재합니다.
- 그러나 `scripts/utils/meili.mk` 및 `scripts/utils/mongo.mk` 에서는 `apps/crawler/src/scripts/...` 형태로 경로를 참조하고 있어 모듈을 찾을 수 없는 오류(`MODULE_NOT_FOUND`)가 발생합니다.
- 또한, 이전 작업([009-remove-workspace-mount](file:///home/ejpark/workspace/scraper/docs/artifacts/009-remove-workspace-mount.plan.md))에서 `WORKSPACE_MOUNT`를 제거하기로 결정했으나, 해당 파일들에 `$(WORKSPACE_MOUNT)` 옵션이 잔재해 있었습니다.
- `scripts/utils/mongo.mk` 내 `index` 명령어에서 `viewer`라는 정의되지 않은 서비스를 대상으로 구동을 시도하고 있어 `worker`로 변경이 필요합니다.

## 2. 해결 방안
- `scripts/utils/meili.mk` 및 `scripts/utils/mongo.mk` 내부의 `apps/crawler/` 경로 접두사를 제거하여 `src/scripts/...` 형태로 컨테이너 내부 경로와 맞춥니다.
- 잔재해 있는 `$(WORKSPACE_MOUNT)` 옵션을 제거하여 컨테이너 환경을 온전한 빌드 형상 기준으로 동작하도록 정렬합니다.
- `scripts/utils/mongo.mk` 의 `index` 구동 서비스를 `worker` 로 변경합니다.

## 3. 작업 계획

| File Path | Action | Details |
| :--- | :--- | :--- |
| `scripts/utils/meili.mk` | Modify | `$(WORKSPACE_MOUNT)` 제거 및 `apps/crawler/` 접두사 제거 |
| `scripts/utils/mongo.mk` | Modify | `$(WORKSPACE_MOUNT)` 제거, `apps/crawler/` 접두사 제거, `viewer` 서비스를 `worker`로 변경 |

## 4. 변경 예정 코드 상세

### `scripts/utils/meili.mk` (변경 후)
```makefile
refresh-index:
	@echo "🐳 Syncing MongoDB Silver documents to Meilisearch index (Upsert mode)..."
	$(COMPOSE) run --rm $(RUN_USER) -v /app/node_modules -T worker npx ts-node src/scripts/meili-manager.ts $(if $(SITE),--site $(SITE),)

reset-index:
	@echo "🐳 Clearing index and rebuilding all Meilisearch documents (Clean Rebuild mode)..."
	$(COMPOSE) run --rm $(RUN_USER) -v /app/node_modules -T worker npx ts-node src/scripts/meili-manager.ts --clean $(if $(SITE),--site $(SITE),)

reindex:
	@echo "🐳 Resetting and rebuilding Meilisearch index for SITE=$(SITE)..."
	$(COMPOSE) run --rm $(RUN_USER) -v /app/node_modules -T worker npx ts-node src/scripts/meili-manager.ts --clean $(if $(SITE),--site $(SITE),)

status:
	@echo "🐳 Checking Meilisearch index statistics..."
	@$(COMPOSE) run --rm $(RUN_USER) -v /app/node_modules -T worker node -e "\
		fetch('http://meilisearch:7700/stats', { headers: { Authorization: 'Bearer superMasterKeySecret123' } })\
			.then(r => r.json())\
			.then(data => console.log(JSON.stringify(data, null, 2)))\
			.catch(err => console.error('Error fetching stats:', err.message))"
```

### `scripts/utils/mongo.mk` (변경 후)
```makefile
index:
	@echo "🐳 Running index synchronization via volume-mounted temporary container..."
	$(COMPOSE) run --rm -T worker npx ts-node src/scripts/sync-indexes.ts

show-columns:
	@echo "🔍 Mapping MongoDB Collection Columns..."
	$(COMPOSE) run --rm $(RUN_USER) -v /app/node_modules worker npx ts-node src/scripts/show_collection_columns.ts
```
