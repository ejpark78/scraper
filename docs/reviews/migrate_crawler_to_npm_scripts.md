# Review: Crawler Scripts 마이그레이션 (NPM Scripts 이관)

본 문서는 `scripts/sites` 마이그레이션 품질을 리뷰하는 문서입니다.

## 🧐 품질 다축 검토 (Multi-Axis Quality Review)

### 1. 관심사 분리 (Separation of Concerns)
- **평가:** 매우 양호합니다.
- **상세:** 크롤러 전용 태스크 명령어들이 `apps/crawler/package.json` 내부로 온전히 귀속되어 서비스 바운더리가 견고해졌습니다.

### 2. 하위 호환성 (Backward Compatibility)
- **평가:** 100% 호환됩니다.
- **상세:** 루트 Makefile의 래핑 레이어가 동일한 매개변수(`PAGE`, `LIST_SLACK`)를 감지하고 `--` 포워딩 방식으로 npm 스크립트에 값을 흘려주므로, 기존의 인프라 크론 및 CLI 타겟은 아무런 수정 없이 동일하게 가동됩니다.

### 3. 파일 유지보수 오버헤드 감소
- **평가:** 파격적으로 줄어들었습니다.
- **상세:** 이전엔 사이트가 9개 늘어나면 9개의 `.mk` 파일이 프로젝트 루트에 존재해야 했으나, 이제 단 하나의 `package.json` 안에서 선언적으로 관리되므로 변경 이력과 형상 복잡도가 극대화로 단순해졌습니다. 또한 `apps/crawler/Makefile` 신규 구축을 통해 루트 Makefile의 구조가 매우 간결해지고 크롤러 전용 관리 명령어 및 Gmail 도구 동기화의 단독 빌드가 가능해졌습니다.

### 4. run-scrape 및 매개변수 격리
- **평가:** 양호합니다.
- **상세:** `PAGE` 및 `LIST_SLACK` 변수 선언과 `run-scrape` 로직 또한 `apps/crawler/Makefile` 내부로 안전하게 이전되었으며, 루트 `Makefile`은 단순 통과 래퍼 역할만 수행하여 루트 레벨의 스파게티 설정을 전면 정리하였습니다.
