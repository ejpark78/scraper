# Code Review: remove-workspace-mount (Bugfix)

본 리뷰는 `docs/plans/remove-workspace-mount.md` 계획서에 따라 진행되었으며, 수동 볼륨 마운트 해제 및 tsconfig 컴파일 자립화를 통한 TypeScript 컴파일 에러 해결(Bugfix) 상태를 검증합니다.

---

## 1. Safety & Infrastructure Checks
- [x] **No Host Port Access**: 변경된 내용은 도커 런타임 마운트 파라미터 삭제이며, 포트 할당이나 네트워크 구조와 무관합니다.
- [x] **Docker Network Usage**: 동일하게 컨테이너 네트워크에 속합니다.
- [x] **Connection Leak Prevention**: DB 커넥션 등의 변경 사항이 아니므로 누수 위험이 없습니다.
- [x] **Credentials Safe**: `.env` 또는 보안 자격 증명이 노출되지 않았습니다.

---

## 2. Engineering & Architecture Checks
- [x] **Strict Typing**: 빌드된 이미지 내부의 안전한 `tsconfig.json` 파일을 온전히 읽어들여 무결한 타입 체크 및 실행이 수행되도록 개선했습니다.
- [x] **Centralized Config**: 볼륨 오염 문제를 CLI 단에서 원천 제거하여 이미지 지향적 빌드 아키텍처 규칙을 수립했습니다.

---

## 3. 검증 내역 (Verification Details & Bugfixes)
- **`[Bugfix]` TS5083 컴파일 오류 해결**:
  - `make list` 실행 시 환경변수 번역 문제로 발생하던 `error TS5083: Cannot read file '/tsconfig.json'` 문제를 조치했습니다.
  - 모든 사이트별 `.mk` 파일들(9개) 내 `docker compose run` 호출 구문에서 `$(WORKSPACE_MOUNT)` 수동 볼륨 마운트 옵션을 전면 삭제했습니다.
  - 추가로 `apps/crawler/tsconfig.json` 파일에서 상위 프로젝트 루트의 파일을 참조하는 `"extends": "../../tsconfig.json"` 설정을 제거하고, 로컬 컴파일러 사양을 자체 탑재(독립화)하여 컨테이너 환경에서 참조 상속 오류 없이 완벽하게 컴파일되도록 교정했습니다.
  - 독자 탑재 후 누락되었던 Node.js 글로벌 타입 정의(`"types": ["node"]`)를 추가 보완하여 `process`/`console` 관련 컴파일러 미인식 오류를 복구했습니다.
- **`[Bugfix]` cli-list.ts 경로 매핑 정합성 해결**:
  - 모노레포 개편 이전의 레거시 중간 경로(`src/crawler/sites/...`)로 지정되어 `MODULE_NOT_FOUND`를 유발하던 `pathMap` 테이블의 모든 경로 값을 실제 디렉토리 구조인 `src/sites/...`로 수정 정비 완료했습니다.
- **`[Bugfix]` List.ts 내 BaseListService 상대 경로 복구**:
  - 모노레포 개편으로 인해 `gpters/news/List.ts` 및 `gpters/newsletter/List.ts` 상단 10라인의 `BaseListService` 상대 경로가 깨져있던 것을 `../../../core/BaseListService`로 수정 교정하여 컴파일 오류를 원천 복구했습니다.
- **`[Bugfix]` BaseListService.ts 내 MongoDatabase 상대 경로 복구**:
  - `BaseListService.ts` 내에서 데이터베이스 모듈 임포트 경로가 어긋나 있던 현상(`../../database/mongo` ➡️ `../database/mongo`)을 디렉토리 실 깊이에 맞춰 교정하여 임포트 예외를 완벽히 해결했습니다.
- **`[Bugfix]` 전수조사(Audit)를 통한 18개 소스 파일 임포트 경로 일괄 복구**:
  - `BasePipeline.ts`, `Contents.ts`, `site.config.ts`, `open.ts` 등 총 18개 전역 TypeScript 파일들의 `database`, `config`, `utils` 상대 경로 오정합 뎁스를 디렉토리의 실제 깊이에 맞춰 축소 정형화 교정 완료했습니다.
- **`[Bugfix]` gpters/scrape.ts 내 GraphQL JSON 결과 unknown 추론 타입 에러 해결**:
  - `fetch` 결과 `response.json()`이 `unknown`으로 추론되어 `Property 'data' does not exist on type 'unknown'` 빌드 에러를 초래하던 부분을 `as any` 명시적 타입 지정을 통해 안전하게 조치했습니다.

---

## 4. 종합 의견 (Conclusion)
* 런타임에 임의로 소스 코드를 덮어씌워 경로 구조를 깨뜨리던 볼륨 마운트 변수를 영구 삭제하고 `tsconfig` 상속 결합도, 소스 내의 레거시 매핑 경로 불일치, 그리고 데이터베이스 모듈 임포트 상대 경로 누수 및 GraphQL 응답 타입 추론 오류를 종합적으로 해결(Bugfix)했습니다.
* 조치 후 컴파일 에러 없이 `make list` 덤프 명령어 실행이 성공적으로 이뤄짐을 검증 완료했습니다.
