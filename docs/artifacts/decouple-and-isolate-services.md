# [Plan] Decouple Shared Packages and Isolate Services

이 계획은 모노레포 구조 하에서 이종 언어 간 혼선을 예방하고 빌드 격리성을 확보하기 위해, 루트의 `packages/` 폴더를 제거하고 `apps/crawler` 및 `apps/viewer`를 독자적인 의존성 및 빌드 단위를 지닌 독립 프로젝트로 격리하는 영구 보존용 설계 문서입니다.

## User Review Required

> [!IMPORTANT]
> - 루트 `packages/` 폴더가 완전히 제거됩니다.
> - `apps/crawler` 및 `apps/viewer`는 이제 타 서비스의 파일 시스템을 침범하여 빌드하지 않으며, 각각 자신의 `package.json` 및 `Dockerfile`만을 소유하고 독립 빌드됩니다.
> - Docker Compose 빌드 시 컨텍스트가 각각 `./apps/crawler` 및 `./apps/viewer`로 엄밀하게 좁혀집니다.
> - 컨테이너 내부의 실행 파일 절대 경로는 `/app/src/...` 수준으로 단순화됩니다.

---

## Proposed Changes

### 1. 공통 코드 이관 및 병합
#### [NEW] [config](file:///home/ejpark/workspace/scraper/apps/crawler/src/config/) & [database](file:///home/ejpark/workspace/scraper/apps/crawler/src/database/) (Crawler 하위)
- `packages/config/AppConfig.ts` 및 `packages/database/mongo.ts`, `packages/database/meili.ts` 소스코드를 `apps/crawler/src/` 아래로 복사 및 이관
- `apps/crawler/src/` 내 모든 파일의 상대 경로 임포트(`../../../../packages/...`)를 로컬 상대 경로(예: `../database/...`)로 일제히 수정

#### [NEW] [config](file:///home/ejpark/workspace/scraper/apps/viewer/config/) & [database](file:///home/ejpark/workspace/scraper/apps/viewer/database/) (Viewer 하위)
- `apps/viewer` 역시 독립적인 실행이 가능하도록 전용 DB 커넥터 및 설정 클래스를 하위에 복사/이관
- `apps/viewer/server.ts` 등의 임포트 경로를 이에 맞추어 정리

#### [DELETE] [packages](file:///home/ejpark/workspace/scraper/packages/)
- 공통 `packages` 폴더 및 하위 파일 전면 제거

---

### 2. package.json 의존성 개별 정립
#### [MODIFY] [package.json (Root)](file:///home/ejpark/workspace/scraper/package.json)
- `workspaces` 제거 및 하위 서비스와 분리된 레거시 설정 제거

#### [MODIFY] [package.json (Crawler)](file:///home/ejpark/workspace/scraper/apps/crawler/package.json)
- 수집기 동작에 필요한 프로덕션 의존성(`playwright`, `cheerio`, `imapflow`, `mailparser`, `turndown`, `fs-extra`, `jsdom`, `mongodb`, `ioredis` 등)을 자신의 package.json에 직접 선언

#### [MODIFY] [package.json (Viewer)](file:///home/ejpark/workspace/scraper/apps/viewer/package.json)
- 뷰어 동작에 필요한 의존성 개별 선언

---

### 3. Docker Compose 및 빌드 컨텍스트 변경
#### [MODIFY] [compose.yml](file:///home/ejpark/workspace/scraper/compose.yml) 및 docker 관련 설정
- `crawler` 및 `viewer` 서비스의 빌드 `context`를 `./apps/crawler`, `./apps/viewer`로 각각 격리 설정
- 컨테이너 내부 실행 경로를 `npx ts-node src/cli-list.ts` 형태로 단순화

#### [MODIFY] [yozm.mk](file:///home/ejpark/workspace/scraper/scripts/sites/yozm.mk), [uppity.mk](file:///home/ejpark/workspace/scraper/scripts/sites/yozm.mk) 등 9개 사이트 `.mk`
- 실행 시 경로를 `npx ts-node src/cli-list.ts` 형태로 수정

---

### 4. 코드 리뷰 문서 작성
#### [NEW] [decouple-and-isolate-services.md](file:///home/ejpark/workspace/scraper/docs/reviews/decouple-and-isolate-services.md)
- 작업 후 리뷰 세트(`*.md`, `*.task.md`, `*.walkthrough.md`)를 작성해 커밋

---

## Verification Plan

### Automated Tests
- 없음

### Manual Verification
1. `docker compose build --no-cache`를 통해 각 서비스(crawler, viewer)가 독립 빌드 컨텍스트 하에서 에러 없이 성공적으로 빌드 완료되는지 확인.
2. `make list` 명령을 호출하여 컨테이너 내부의 `/app/src/cli-list.ts`가 성공적으로 작동하는지 검증.
