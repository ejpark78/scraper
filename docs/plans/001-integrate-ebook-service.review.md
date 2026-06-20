# Code Review: Monorepo Restructuring & Ebook Service Integration

파이썬 기반 `ebook` 서적 처리 프로젝트를 모노레포 구조로 통합하고 Docker Compose 서비스로 편입하는 마이그레이션 과정에서 추가/수정된 핵심 코드들에 대한 코드 리뷰 결과입니다.

---

## 🔍 코드 리뷰 요약

### 1. `site.config.ts` (Ebook 설정)
* **대상 파일**: [site.config.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/sites/ebook/site.config.ts)
* **평가**:
  * **설계의 적절성 (Good)**: `SiteDescriptor` 인터페이스 스펙을 충족하며, 크롤링 관련 속성(`scraper`, `converter`)을 생략하고 `targetLoader`와 `indexes`만 간결하게 선언하여 보일러플레이트 코드를 줄였습니다.
  * **타입 안정성 (Good)**: `EbookMeta` 인터페이스를 도입하여 `buildDocument`로 들어오는 파이팅 산출물의 타입을 엄격하게 강제했습니다.
  * **개선 가능 지점**: 
    * `publishedAt` 메타데이터가 없는 서적의 경우 동기화하는 시점의 날짜(`new Date().toISOString()`)가 들어가도록 기본값 처리가 되어 있습니다. 추후 Meilisearch 정렬 왜곡 방지를 위해 책의 실제 출판 연도 등을 파싱하여 대입하는 정교화 로직을 고려해 볼 수 있습니다.

### 2. `sync-ebooks.ts` (서적 데이터 동기화 스크립트)
* **대상 파일**: [sync-ebooks.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/scripts/sync-ebooks.ts)
* **평가**:
  * **식별자 안정성 (Good)**: 리눅스 파일 시스템의 파일명 길이 한계(255자) 문제를 우회하기 위해, 책 제목과 챕터명을 조합한 고유 문자열의 **MD5 해시(32자)**를 고유 ID로 지정함으로써 안정성을 대폭 개선했습니다.
  * **기존 인프라 재활용 (Good)**: MongoDB 적재 성공 후 Redis의 `index_queue`로 챕터 ID를 `rpush`하여, 기존 `IndexerWorker`를 전혀 수정하지 않고 그대로 활용하여 Meilisearch 검색 엔진까지 원스톱으로 연동한 설계가 우수합니다.
  * **개선 가능 지점 (안정성 강화)**:
    * 개별 마크다운 파일(`.md`)을 읽고 DB에 쓰는 루프 안쪽에 개별 `try-catch` 예외 처리를 씌우면, 특정 챕터 파일 로딩/버퍼링 도중 오류가 발생하더라도 전체 서적 동기화가 비정상 종료되지 않고 계속 다음 파일의 동기화 작업을 수행할 수 있어 전체적인 예외 복구력이 강화됩니다.

### 3. `Dockerfile` (Ebook 파이썬 컨테이너)
* **대상 파일**: [Dockerfile](file:///home/ejpark/workspace/scraper/docker/worker/ebook/Dockerfile)
* **평가**:
  * **의존성 설치 최적화 (Good)**: 가상환경 없이 빠른 의존성 설치가 가능한 `uv` 패키지 관리자를 사용하여 컨테이너 내부 시스템 영역에 패키지를 설치함으로써 빌드 성능을 극대화했습니다.
  * **컨텍스트 명확화 (Good)**: 모노레포 구조 상 `pyproject.toml`과 `uv.lock`이 `apps/ebook/` 아래에 존재하므로 이를 빌드 컨텍스트 루트에서 정확하게 복사해 오도록 경로를 명확히 매핑했습니다.

### 4. `compose.yml` 및 `tsconfig.json` (오케스트레이션 및 빌드)
* **대상 파일**: [compose.yml](file:///home/ejpark/workspace/scraper/docker/worker/compose.yml), [tsconfig.json](file:///home/ejpark/workspace/scraper/tsconfig.json)
* **평가**:
  * **자원 격리 최적화 (Good)**: `profiles: ["ebook"]`을 적용하여 배치성 서적 파싱 컨테이너가 기본 웹 서비스(viewer) 및 DB 구동 시 리소스를 낭비하지 않도록 통제했습니다.
  * **경로 해석 안정성 (Good)**: 런타임에 에러를 유발하기 쉬운 `tsconfig-paths` 우회 방식 대신, 상대 경로 임포트 깨짐 현상이 일어난 14개의 핵심 파일들에 대해 모노레포에 맞는 물리적 실제 상대 경로로 완전하게 정적 치환을 마쳐 구동 신뢰성을 확보했습니다.
