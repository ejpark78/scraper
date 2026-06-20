# Code Review: apps/exporter 통합 및 Joplin/Obsidian 내보내기 이식

본 문서는 `apps/exporter` 모듈로 이식된 코드에 대한 코드 리뷰 보고서입니다. `AGENTS.md` 규정에 근거하여 타입 안정성, 예외 처리 메커니즘, 구조적 결합도 측면에서 검증합니다.

---

## 1. 🏗️ 아키텍처 및 모듈 경계 검증
- **독립성**: `apps/exporter`는 `crawler`, `ebook`, `viewer` 모듈과 어떠한 소스 코드 결합(의존성 순환)도 가지지 않으며 독립적인 `tsconfig.json` 및 `package.json`으로 격리되었습니다.
- **Docker 인프라 설계**:
  - `networks.default`를 외부 `scraper_default` 네트워크로 지정하여, 추후 다른 서비스들과 통신(MongoDB, Redis)을 손쉽게 수행할 수 있도록 인프라 통합성을 유지하였습니다.

---

## 2. 🛡️ 타입 안정성 (Strict Typing)
- **any 방지**: 모든 public/private 인터페이스와 옵션에 명시적인 인터페이스 타입(`WikiDocsBook`, `WikiDocsChapter`, `ExportOptions`)을 선언하여 `any` 형식을 차단하였습니다.
- **Strict Mode**: `tsconfig.json`에서 `"strict": true`를 활성화하여 널 가능성(`null | undefined`) 검사 및 암시적 `any`를 엄격하게 차단했습니다.

---

## 3. 🚨 예외 처리 및 자원 관리 (Robust Error Handling)
- **API 네트워크 오류 대응**:
  - Joplin 및 Obsidian API 연동(`joplin.ts`, `obsidian.ts`)에서 `fetch` 호출 후 `response.ok`를 철저히 검사하고 실패 시 상세한 본문 에러 메시지(`response.text()`)를 래핑한 커스텀 `Error`를 throw 하도록 구현하였습니다.
- **로컬 디렉터리 검증**:
  - `fileLoader.ts` 내의 `loadBookFromDirectory` 함수에서는 경로의 실재 여부(`fs.existsSync`) 및 디렉터리 타겟 여부(`fs.statSync().isDirectory`)를 우선 판단한 뒤 작업을 개시함으로써 예외적 실행 에러를 사전 차단하였습니다.
- **호스트 주소 유연성**:
  - 도커 컨테이너 내부 실행에서 로컬 호스트 PC의 Joplin/Obsidian에 원활히 접근할 수 있도록 API 주소의 기본값을 `host.docker.internal`로 유연하게 처리하고 환경변수를 통한 재정의가 가능하게 설계하였습니다.

---

## 4. 📝 종합 결론
- 해당 구현 코드는 타입 안정성이 높고 에러 전파 제어 장치가 훌륭하게 갖춰져 있어, 향후 데이터 정제 파이프라인의 핵심 내보내기 도구로 안정적으로 작동할 것입니다.
