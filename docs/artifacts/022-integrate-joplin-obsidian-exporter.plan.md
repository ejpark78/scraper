# Plan-0001: apps/exporter 통합 및 Joplin/Obsidian 내보내기 이식 계획서

본 문서는 `wikidocs-exporter` 프로젝트에서 사용되던 Joplin 및 Obsidian 파일 전송/내보내기 기능을 `scraper` 프로젝트의 독립 애플리케이션 `apps/exporter`로 이식하기 위한 상세 계획서입니다.

---

## 1. 개요 및 목적
- `wikidocs-exporter`의 핵심 내보내기(Export) 로직을 이식하여 수집된 컨텐츠를 Joplin 또는 Obsidian으로 쉽게 내보낼 수 있도록 합니다.
- `apps/exporter`는 `crawler`, `ebook`, `viewer` 등 기존 앱들과 독립된 단독 모듈로 동작합니다.
- 자체 `Dockerfile`, `compose.yml`, `Makefile`을 두어 독자적인 Docker 실행 환경을 제공하며, MongoDB 등의 공유 자원에 접근할 수 있도록 네트워크 및 인프라를 구성합니다.

---

## 2. 아키텍처 및 폴더 구조

`apps/exporter/` 하위에 다음과 같이 파일 구조를 생성합니다.

```
apps/exporter/
├── Dockerfile                   # Node.js TypeScript 실행용 Docker 이미지 정의
├── compose.yml                  # 독립 실행 및 scraper 네트워크 공유를 위한 docker-compose 설정
├── Makefile                     # build, run, test 등 로컬 및 Docker 실행 편의를 위한 명령어 정의
├── package.json                 # 의존성 정의
├── tsconfig.json                # TypeScript 빌드 설정
└── src/
    ├── index.ts                 # CLI 엔트리포인트 (MongoDB에서 스크랩된 컨텐츠를 읽어 export 실행)
    ├── export/
    │   ├── index.ts             # Exporter 모듈 통합 Export
    │   ├── joplin.ts            # Joplin Web Clipper API 연동 로직
    │   ├── obsidian.ts          # Obsidian Local REST API 연동 로직
    │   └── base.ts              # 파일명 정제(sanitizeFilename) 등 공통 유틸리티
    ├── generators/
    │   └── index.ts             # INDEX.md 생성을 위한 마크다운 포매터
    ├── types/
    │   └── index.ts             # Book, Chapter, ExportOptions 타입 정의
    └── utils/
        └── db.ts                # MongoDB 연결 및 데이터 조회 서비스 (기존 DB 구조 재사용)
```

---

## 3. 상세 수정 및 신규 생성 파일 계획

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/exporter/package.json` | Create | TypeScript, ts-node, mongoose/mongodb, dotenv 등의 의존성 및 CLI 실행 스크립트 작성 |
| `apps/exporter/tsconfig.json` | Create | 모듈 분석 및 빌드 설정을 위한 tsconfig 정의 |
| `apps/exporter/Dockerfile` | Create | `node:20-alpine` 기반 빌드 및 CLI 작동 환경 설정 |
| `apps/exporter/compose.yml` | Create | `scraper_default` 네트워크 조인, 환경 변수(`.env`) 바인딩, CLI 볼륨 매핑 |
| `apps/exporter/Makefile` | Create | `make run-exporter`, `make build` 등의 명령어 정의 |
| `apps/exporter/src/types/index.ts` | Create | 내보내기에 필요한 Book, Chapter, ExportOptions 구조체 정의 |
| `apps/exporter/src/export/base.ts` | Create | 파일 이름 등 공통 문자열 정제(sanitizeFilename) 함수 정의 |
| `apps/exporter/src/generators/index.ts` | Create | index 마크다운 형식 생성(Obsidian, Joplin 스타일 개별 포맷팅) 구현 |
| `apps/exporter/src/export/joplin.ts` | Create | Joplin Web Clipper API(HTTP)를 활용한 폴더 및 노트 자동 생성 구현 |
| `apps/exporter/src/export/obsidian.ts` | Create | Obsidian REST API(HTTP/HTTPS)를 활용한 볼트(Vault) 내 마크다운 파일 전송 구현 |
| `apps/exporter/src/utils/db.ts` | Create | MongoDB의 `bronze` 또는 변환된 `silver/gold` 데이터를 조회하여 내보내기 객체(Book)로 변환해주는 DB 유틸 구현 |
| `apps/exporter/src/index.ts` | Create | CLI 인자 파싱(Export Target, API 토큰, Book ID/Title 입력) 및 실행 제어 루프 구현 |

---

## 4. 상세 연동 방식 및 인터페이스

### Joplin
- **포트 및 주소**: `http://localhost:41184` (로컬 Joplin 앱이 켜져 있어야 함)
- **API 토큰**: Joplin 웹 클리퍼 설정 화면에서 획득
- **동작**:
  1. `Wikidocs` 루트 폴더가 없으면 생성
  2. 서적명(Book Title) 폴더 생성 (루트 폴더 하위)
  3. 챕터별 노트를 해당 폴더 내에 생성
  4. 인덱스 노트 생성 (Joplin 내부 앵커 링크 연결 형식)

### Obsidian
- **포트 및 주소**: `http://127.0.0.1:27123` (HTTP) 또는 `https://127.0.0.1:27124` (HTTPS)
- **API 키**: Local REST API 플러그인 설정 화면에서 획득
- **동작**:
  1. `/WikiDocs/서적명/` 폴더 하위에 파일 쓰기 (`PUT /vault/WikiDocs/서적명/챕터명.md`)
  2. `INDEX.md` 파일 생성 (마크다운 상대경로 링크 형식)

---

## 5. 실행 및 검증 시나리오

1. **Docker 빌드 테스트**:
   - `docker compose -f apps/exporter/compose.yml build` 실행 테스트
2. **로컬 개발 실행 테스트**:
   - 로컬에 Joplin 또는 Obsidian을 실행
   - `apps/exporter` 내에서 CLI를 통해 특정 책을 선택해 내보내기 작동 여부 확인
   - 예: `docker compose -f apps/exporter/compose.yml run --rm exporter npm run start -- --target=joplin --token=... --book=...`
