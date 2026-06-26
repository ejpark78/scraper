# 🕵️‍♂️ 프로젝트 안티패턴 분석 보고서

본 보고서는 LinkedIn Clipper & Crawler 프로젝트 내의 아키텍처, 코드 중복, 데이터베이스 커넥션 관리 및 타입 안전성 측면에서 식별된 주요 안티패턴을 정리한 문서입니다.

---

## 🚨 1. 주요 안티패턴 요약

| 분류 | 안티패턴 항목 | 위험 요소 | 개선 방향 |
| :--- | :--- | :--- | :--- |
| **DRY 원칙 위반** | `MongoDatabase` 클래스 중복 선언 | 코드 변경 시 동기화 누락 및 유지보수 비용 증가 | 공통 `shared/database` 모듈 또는 루트 워크스페이스 라이브러리로 분리 |
| **DRY 원칙 위반** | `Converter` 내 `prettify`, `prettifyAndSave` 중복 구현 | 10개 이상의 사이트 컨버터가 동일한 포맷팅 및 파일 저장 코드를 중복 소유 | `BaseConverter` 추상 클래스 또는 헬퍼 유틸리티 도입 |
| **자원 관리** | Graceful Shutdown 처리 부재 | 컨테이너 중지 또는 시스템 예외 발생 시 MongoDB/Redis 커넥션이 열려 있어 자원 누수 발생 | `process.on('SIGTERM', ...)` 헨들러를 통한 명시적 커넥션 릴리즈 |
| **타입 안전성** | Strict Typing 위반 (`any` 사용) | `as any` 캐스팅 및 `any` 매개변수 사용으로 컴파일 타임 에러 검증 무력화 | 구체적 인터페이스 정의 또는 `unknown`과 타입 가드 활용 |
| **환경 제어** | 환경 변수 하드코딩 및 이중 관리 | `process.env.REDIS_URL || 'redis://redis:6379'` 형태로 개별 워커에 하드코딩됨 | `AppConfig` 구조로 단일화 및 중앙 제어 |

---

## 🔍 2. 세부 분석 및 코드 사례

### A. 패키지 간 데이터베이스 어댑터 중복
- **대상 파일**: 
  - [apps/crawler/src/database/mongo.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/database/mongo.ts)
  - [apps/viewer/src/database/mongo.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/database/mongo.ts)
- **현상**: 모노레포 아키텍처를 지향하고 있음에도 불구하고, `crawler` 패키지와 `viewer` 패키지에 동일한 구조의 싱글턴 `MongoDatabase`가 각각 정의되어 있습니다.
- **영향**: 스키마 구조 변경이나 연결 옵션 변경 시 두 패키지의 코드를 모두 변경해 주어야 합니다.

### B. 각 사이트별 Converter의 유틸리티 로직 중복
- **대상 파일**: `apps/crawler/src/sites/*/Converter.ts` (총 10개 파일)
- **현상**:
  - `prettify(rawText: string)`: Prettier를 통한 마크다운 포맷팅 로직이 모든 파일에 중복 구현되어 있습니다.
  - `prettifyAndSave(rawText: string, outputPath: string)`: 디렉토리를 생성하고 마크다운을 저장하는 파일 I/O 로직이 완전히 동일하게 반복됩니다.
  - `htmlToMarkdown(html: string)`: Turndown 서비스를 로드하고 커스텀 태그를 제거하는 핵심 로직 역시 다수의 컨버터가 직접 내포하고 있습니다.
- **영향**: 코드 중복률이 매우 높으며, 전역 포맷팅 규칙(예: Prettier 옵션)을 수정하려 할 때 10개 이상의 파일을 전수 수정해야 합니다.

### C. Graceful Shutdown 핸들러 부재
- **대상 파일**:
  - [apps/crawler/src/workers/ConverterWorker.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/workers/ConverterWorker.ts)
  - [apps/crawler/src/workers/ScraperWorker.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/workers/ScraperWorker.ts)
- **현상**: `main()` 함수 실행 시 MongoDB 연결과 Redis 인스턴스 생성이 이루어지나, OS 시그널(`SIGTERM`, `SIGINT`) 또는 런타임 예외로 프로세스가 강제 종료될 때 기존의 커넥션들을 릴리즈(`close()`, `quit()`)하는 처리기가 등록되어 있지 않습니다.
- **영향**: 커넥션 풀이 누수되어 DB 서버의 동시 연결 제한(Connection Limit)에 도달할 위험이 존재합니다.

### D. Strict Typing 규칙 위반
- **현상**: `any` 타입을 다량으로 명시하거나, `(converter as any).fetchAndConvertFromJsonApi` 등 타입을 우회하여 개발된 영역이 존재합니다.
- **영향**: TypeScript의 강력한 정적 타입 검사의 이점을 누리지 못하고 런타임 에러로 이어질 수 있습니다.

---

## 🛠️ 3. 제안하는 리팩터링 방향

1. **공통 데이터베이스/유틸리티 패키지 분리**: 
   - 모노레포 구조에 맞는 `packages/shared` 혹은 `packages/core` 형태의 공통 라이브러리 레이어를 신설하여 `MongoDatabase` 및 공통 마크다운 컨버터 기능(`MarkdownUtils`)을 일원화합니다.
2. **BaseConverter 추상 클래스 설계**:
   - `IConverter` 인터페이스를 확장한 `BaseConverter` 추상 클래스를 작성하고, 공통 기능(`prettify`, `prettifyAndSave`, `htmlToMarkdown` 기본 루틴)을 템플릿 메소드 패턴 형태로 구현하여 하위 클래스의 코드 중복을 90% 이상 제거합니다.
3. **공통 헬퍼 등록 및 Graceful Shutdown 공통 유틸 도입**:
   - 프로세스 생명 주기를 관리할 수 있는 `ShutdownManager`를 통해 DB 커넥션을 동적으로 트래킹하고 SIGTERM/SIGINT 신호가 들어왔을 때 열려 있는 모든 연결을 안전하게 종료하도록 일괄 처리합니다.
