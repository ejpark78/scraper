# [LLM Wiki Monorepo Restructuring & Ebook Integration Plan]

프로젝트의 지속적인 확장성(LinkedIn Jobs, 메일링 리스트, 기술 서적 통합 등)을 확보하고 이종 언어(TypeScript, Python) 간 격리와 공통 모듈 공유를 완벽히 지원하기 위해, 전체 프로젝트를 **서비스 중심 모노레포(Monorepo) 구조**로 리팩토링하고 파이썬 기반 `ebook` 서비스를 통합하는 계획입니다.

## User Review Required

> [!IMPORTANT]
> - **대대적인 코드 이동**: 모든 TypeScript 소스(`src/`)가 `apps/` 및 `packages/` 하위로 분산 이동합니다. 임포트 경로 오류를 방지하기 위해 TypeScript Path Aliases(예: `@wiki/database`) 설정을 도입합니다.
> - **데이터 저장소 통합**: 기존 `ebook/data`에 분산되어 있던 대용량 PDF 책 파일들은 프로젝트 루트의 공통 데이터 폴더인 `data/ebook/` 하위로 일괄 이관 및 통합합니다. 이를 통해 Git 관리 누락 방지와 디렉토리 일관성을 유지합니다.
> - **Docker Compose 프로파일 적용**: `ebook` 서비스는 상시 구동이 필요 없는 배치성 작업이므로, Docker Compose의 `profiles: ["ebook"]` 설정을 도입합니다. 명시적으로 프로파일을 호출할 때만 구동되도록 제어하여 로컬 시스템 자원을 절약합니다.
> - **단계적 마이그레이션**: 서비스 중단을 방지하고 오류 추적을 쉽게 하기 위해 리팩토링은 `1) 뼈대 구축 및 공통 패키지 추출 -> 2) TS 서비스 분리 -> 3) Python ebook 통합 -> 4) Docker & 빌드 환경 복원` 순으로 단계별 진행합니다.

---

## Proposed Directory Structure

마이그레이션 완료 후 최종 구조는 다음과 같습니다.

```text
/workspace/scraper/
├── apps/                        # 독립 실행 서비스 (Applications)
│   ├── crawler/                 # TS 크롤러 (Scraper, Converter, Indexer Workers)
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── viewer/                  # 웹 뷰어 및 API 서버 (Vite Vue + Express)
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── ebook/                   # [Python] 기술 서적 PDF/EPUB 파서 및 분석기
│       ├── src/                 # 파이썬 소스 코드 (process.py, translate.py 등)
│       └── pyproject.toml       # uv 의존성 설정
│
├── packages/                    # 공통 라이브러리 (Shared Packages)
│   ├── database/                # MongoDB, Redis, Meilisearch 커넥터 및 스키마
│   │   └── index.ts
│   ├── config/                  # 애플리케이션 공통 환경설정 및 로더
│   │   └── index.ts
│   └── utils/                   # 날짜, 포맷팅, 파일 핸들링 등 공통 유틸리티
│
├── data/                        # 프로젝트 공통 데이터/임시 저장소
│   └── ebook/                   # 원본 기술 서적 PDF 저장소 (.gitignore 대상)
│
├── compose.yml                  # 모노레포 통합 컨테이너 오케스트레이션
├── package.json                 # 모노레포 루트 package.json (npm workspaces 정의)
└── tsconfig.json                # 루트 TS 설정 (Path Aliases 공통 상속용)
```

---

## Proposed Changes

### 1단계: 모노레포 구조 기틀 및 공통 패키지 구성
* **패키지 분리**:
  * `packages/database/` 생성 후 `src/database/`에 있던 MongoDB, Redis, Meilisearch 파일 이관 및 단일 진입점(`index.ts`) 제공.
  * `packages/config/` 생성 후 `src/config/` 내부 설정 로더 이관.
* **루트 설정 변경**:
  * 루트 `package.json`을 수정하여 `npm workspaces` 적용 (`"workspaces": ["apps/*", "packages/*"]`).
  * 루트 `tsconfig.json`에 `compilerOptions.paths` 적용 (예: `@wiki/database`, `@wiki/config` 정의).

### 2단계: TypeScript 서비스 분리 (`apps/crawler`, `apps/viewer`)
* **`apps/crawler` 구성**:
  * `src/crawler/`에 있던 모든 로직을 `apps/crawler/src/` 아래로 이관.
  * 독립적인 실행을 위한 `apps/crawler/package.json` 및 `tsconfig.json` 정의.
* **`apps/viewer` 구성**:
  * `src/viewer/` 아래에 있던 뷰어 프론트엔드 및 API 서버 코드를 `apps/viewer/`로 이관.
  * 프론트엔드(`apps/viewer/frontend/`)와 백엔드 API 서버 빌드 경로 조절.

### 3단계: 파이썬 서적 처리 서비스 통합 (`apps/ebook`)
* **소스 이관 및 데이터 통합**:
  * `../ebook` 레포지토리의 소스 코드(`process.py`, `translate.py`, `books.json`, `pyproject.toml`, `uv.lock`)를 `apps/ebook/` 아래로 복사.
  * `../ebook/data/` 내부의 원본 PDF/EPUB 등 책 파일들은 `scraper/data/ebook/` 아래로 일괄 이관.
* **동기화 파이프라인 추가**:
  * `apps/ebook/`에서 파이싱이 완료되어 생성된 Markdown 파일을 MongoDB에 주입하고 Meilisearch에 색인하는 TS 기반 스크립t(`apps/crawler/src/scripts/sync-ebooks.ts`) 추가.

### 4단계: Docker & 빌드 오케스트레이션 개편
* **Dockerfile 조정**:
  * `docker/worker/` 밑의 `scraper`, `converter`, `indexer` Dockerfile들의 빌드 컨텍스트 및 복사 경로 수정.
  * `docker/worker/ebook/Dockerfile` 신규 작성하여 파이썬 및 `uv` 구동 환경 구축.
* **compose.yml 수정**:
  * `ebook` 서비스를 구성하고 `profiles: ["ebook"]`을 적용하여 자원 격리.
  * 볼륨 마운트 (`./apps/ebook:/app` 및 `./data/ebook:/app/data`) 및 MongoDB 공유 네트워크 조인.
  * 기존 `viewer`, `worker` 등의 빌드 컨텍스트 경로 수정.

---

## Verification Plan

### Automated Tests
1. 모노레포 의존성 설치 및 린트/컴파일 검증:
   ```bash
   npm install
   npm run build --workspaces
   ```
2. 개별 서비스 Docker 빌드 테스트 (ebook은 프로파일과 함께 테스트):
   ```bash
   docker compose build crawler
   docker compose build viewer
   docker compose --profile ebook build ebook
   ```

### Manual Verification
1. `docker compose up`으로 전체 스택 구동 후, `viewer` 웹 브라우저가 정상 로드되는지 확인 (ebook은 실행되지 않는 상태).
2. `docker compose --profile ebook run --rm ebook uv run python process.py --help` 명령으로 임시 실행이 정상 구동되는지 확인.
3. `apps/ebook` 컨테이너 내에서 샘플 책 마이그레이션이 동작하고 Markdown이 MongoDB와 Meilisearch에 잘 적재되는지 위키 UI를 통해 조회 테스트.
