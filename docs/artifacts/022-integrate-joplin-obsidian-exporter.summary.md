# Summary: 022-integrate-joplin-obsidian-exporter

> Squashed from: 022-integrate-joplin-obsidian-exporter.review.md 022-integrate-joplin-obsidian-exporter.task.md 022-integrate-joplin-obsidian-exporter.walkthrough.md

---

## Review

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

---

## Task

# Task List: apps/exporter 통합 및 Joplin/Obsidian 내보내기 이식

본 문서는 `apps/exporter` 이식 작업의 단계별 수행 내역을 기록하는 할 일 목록 보존 문서입니다.

## 🏁 진행 상태 요약
- **시작일**: 2026-06-20
- **상태**: 완료 (Completed)

---

## 📝 상세 할 일 및 수행 완료 여부

- [x] 1단계: 마이그레이션 계획서 작성 및 승인 받기
  - [x] `docs/plans/0001-integrate-joplin-obsidian-exporter.md` 작성 완료 및 승인 완료
- [x] 2단계: `apps/exporter` 기본 구조 설정
  - [x] `package.json` 신규 작성 및 의존성 정의
  - [x] `tsconfig.json` 신규 작성
- [x] 3단계: 도커 실행 환경 설정
  - [x] `Dockerfile` 작성 (의존성 로드 및 ts 빌드 설정)
  - [x] `compose.yml` 작성 (로컬 볼륨 마운트 및 scraper_default 네트워크 연동)
  - [x] `Makefile` 작성 (build, run, shell 명령어 단축 키바인딩 제공)
- [x] 4단계: 소스코드 이식 및 구현
  - [x] `src/types/index.ts` 타입 설정
  - [x] `src/export/base.ts` 파일명 sanitize 헬퍼 포팅
  - [x] `src/generators/index.ts` INDEX.md 포매터 구현
  - [x] `src/export/joplin.ts` Joplin API 연동 및 노트 업로더 포팅
  - [x] `src/export/obsidian.ts` Obsidian REST API 연동 및 파일 업로더 포팅
  - [x] `src/utils/fileLoader.ts` 로컬 마크다운 디렉터리 로더 구현
  - [x] `src/index.ts` CLI 인자 파서 및 제어기 포팅
- [x] 5단계: 빌드 및 헬프 가이드 동작 테스트
  - [x] `docker compose build` 에러 디버깅 및 수정 (`npm ci` -> `npm install` 패키지락 예외 조치)
  - [x] `--help` 인자 입력 시 CLI 도움말 메시지 정상 출력 확인
- [x] 6단계: 문서화 수명 주기 보존
  - [x] 코드 리뷰(`0001-integrate-joplin-obsidian-exporter.md`) 작성
  - [x] 결과보고서(`0001-integrate-joplin-obsidian-exporter.walkthrough.md`) 작성
  - [x] 루트 `CHANGELOG.md` 업데이트

---

## Walkthrough

# Walkthrough: apps/exporter 통합 및 Joplin/Obsidian 내보내기 이식 결과보고서

본 문서는 `apps/exporter` 이식 작업을 수행한 뒤 성공한 빌드 및 실행 테스트 검증 명세입니다.

---

## 1. 빌드 및 테스트 환경
- **Docker Image**: `node:20-alpine` 기반 빌드
- **컨테이너명**: `scraper-exporter`
- **네트워크**: `scraper_default` (기존 DB 인프라 공유용 외부 네트워크 연동)
- **볼륨 마운트**: 로컬 개발 코드가 실시간 동기화되도록 볼륨 설정 (`.:/app`)

---

## 2. Docker 빌드 로그 요약

`docker compose -f apps/exporter/compose.yml build` 수행 시:
1. `npm install`을 이용해 패키지 설치 완료 (package-lock.json 미존재 예외 극복)
2. `tsc` 컴파일러를 통해 TypeScript 빌드 성공 (`dist/index.js` 생성 확인)

---

## 3. CLI 실행 검증 결과
`docker compose -f apps/exporter/compose.yml run --rm exporter npm run start -- --help`를 수행한 결과 아래와 같이 도움말이 정상 작동하였습니다:

```
📚 Scraper Exporter CLI
사용법: npm run start -- [옵션]

옵션:
  --target=joplin|obsidian    내보낼 대상 앱 (필수)
  --path=DIRECTORY_PATH       내보낼 책/문서가 들어있는 폴더 경로 (필수)
  --token=JOPLIN_TOKEN        Joplin API 웹클리퍼 토큰 (target이 joplin일 때 필수)
  --key=OBSIDIAN_API_KEY      Obsidian Local REST API 키 (target이 obsidian일 때 필수)
  --addFrontmatter=true|false 각 노트에 프론트매터 자동 추가 여부 (기본값: true)
  --createIndex=true|false    INDEX.md 파일 자동 생성 여부 (기본값: true)

예시:
  # Joplin으로 내보내기
  npm run start -- --target=joplin --path="/app/data/ebook/output/Generative AI on Kubernetes - Roland Huss , Daniele Zonca 2026" --token=abcd1234efgh

  # Obsidian으로 내보내기
  npm run start -- --target=obsidian --path="/app/data/ebook/output/Generative AI on Kubernetes - Roland Huss , Daniele Zonca 2026" --key=your-obsidian-rest-api-key
```

---

## 4. 결론 및 모듈 사용 안내
- `apps/exporter` 패키지는 성공적으로 Monorepo 하위에 이식 및 조립되었습니다.
- 사용자는 `data/ebook` 또는 `data/sites` 등에 수집 완료된 마크다운 결과물 디렉터리를 가리켜 로컬에 설치된 Joplin 또는 Obsidian 앱으로 직접 파일 전송을 진행할 수 있습니다.

---

