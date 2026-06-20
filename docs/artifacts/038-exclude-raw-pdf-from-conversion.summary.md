# Summary: 038-exclude-raw-pdf-from-conversion

> Squashed from: 038-exclude-raw-pdf-from-conversion.review.md 038-fix-sites-config-generation-path.review.md 038-exclude-raw-pdf-from-conversion.task.md 038-fix-sites-config-generation-path.task.md 038-exclude-raw-pdf-from-conversion.walkthrough.md 038-fix-sites-config-generation-path.walkthrough.md

---

## Review

### 038-exclude-raw-pdf-from-conversion.review

# 리뷰: raw/ 디렉토리 PDF 변환 제외 필터링

## 변경 사항

- **파일:** `apps/ebook/src/process.py`
- **수정 내용:**
  - `--pdf2html` 모드 (L66-72): `**/*.pdf` glob 결과에서 `"raw"`가 경로에 포함된 파일 제외
  - `--html2md` 모드 (L118-124): `**/*.html` glob 결과에서 `"raw"`가 경로에 포함된 파일 제외
- **Bugfix** 여부: **Bugfix** — 기존에 raw/ 내 PDF도 변환 대상에 포함되던 버그 수정

## 원인

`--pdf2html all` 및 `--html2md all` 모드가 `search_dir.glob("**/*.pdf")` / `search_dir.glob("**/*.html")` 재귀 패턴을 사용하여 `data/ebook/raw/` 디렉토리 내 원본 PDF까지 검색 대상에 포함시킴. `raw` 디렉토리를 제외하는 필터링 로직이 전혀 없었음.

## 수정 내용

glob 수집 직후 리스트 컴프리헨션으로 `"raw" not in p.resolve().parts` 조건 필터링 추가.
- `p.resolve().parts`는 경로를 `/` 단위로 분할한 튜플 반환 → 디렉토리명이 정확히 `raw`인 경우만 제외
- `raw_text`, `raw_blocks` 등 데이터 변수명과 혼동되지 않음 (경로 문자열 기반)

## 영향 범위

- `--split`/`--pdf2md` 모드는 `data_path.glob("*.pdf")` (비재귀) 사용으로 영향 없음
- `--pdf2html` / `--html2md` 모드의 `raw/` 제외만 추가
- 다른 기능에 사이드 이펙트 없음

## 검증

```bash
# data/ebook/raw/ 내 PDF는 제외되고 data/ebook/*.pdf 만 변환되어야 함
docker compose -p scraper run --rm --user $(id -u):$(id -g) \
  -v $(pwd):/app -v /app/node_modules worker \
  npx ts-node src/process.py --pdf2html all
```

### 038-fix-sites-config-generation-path.review

# 🔍 Code Review: Fix Static Sites Configuration Generation Path

## 1. 개요
- **목적**: 뷰어가 사이트 메타데이터 및 올바른 Meilisearch 인덱스명을 인지할 수 있도록 프로젝트 루트 `config/sites.json`에 빌드 타임 설정 파일이 제대로 생성되도록 경로 수정
- **유형**: Bugfix (버그 수정)

## 2. 변경 내용 및 자가 진입점 평가
- [generate-sites-config.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/scripts/generate-sites-config.ts#L41)에서 `configDir`의 상대 경로 분석 단계가 잘못 설정되어 `apps/crawler/config`로 가던 오류를 `..`을 추가하여 프로젝트 루트의 `config`로 수정했습니다.
- 이에 따라 스크립트 실행 결과로 생성된 `sites.json`을 `viewer-api` 및 `viewer-fe` 빌드 컨텍스트에서 정상 인식할 수 있게 됩니다.

## 3. 평가
- **올바름(Correctness)**: 생성 경로가 `/home/ejpark/workspace/scraper/config/sites.json`으로 올바르게 정렬되었으며, 뷰어가 인덱스 이름 매핑 정보를 정상 로드할 수 있게 됩니다.
- **가독성(Readability)**: 기존 resolve 인자 구조를 깨지 않고 디렉터리 수준만 한 단계 상위로 조정한 안전한 리팩토링입니다.
- **아키텍처(Architecture)**: 뷰어와 크롤러의 빌드 타임 공유 메타데이터가 단일 통합 경로(`config/sites.json`)에서 올바르게 동기화되는 아키텍처 일관성을 회복했습니다.

---

## Task

### 038-exclude-raw-pdf-from-conversion.task

# Task: raw/ 디렉토리 PDF 변환 제외 필터링

## 완료된 작업

- [x] `apps/ebook/src/process.py` — `--pdf2html` 모드에 `raw/` 경로 필터 추가
- [x] `apps/ebook/src/process.py` — `--html2md` 모드에 `raw/` 경로 필터 추가
- [x] `docs/artifacts/038-exclude-raw-pdf-from-conversion.*` 문서 세트 작성

### 038-fix-sites-config-generation-path.task

# 📋 Task: Fix Static Sites Configuration Generation Path

이 태스크 목록은 `sites.json` 정적 설정 파일이 올바른 경로에 배치되도록 조치하는 과정을 관리합니다.

## 할 일 목록
- [x] `apps/crawler/src/scripts/generate-sites-config.ts` 의 파일 생성 경로 교정
- [x] 호스트 로컬 상에서 `npx ts-node apps/crawler/src/scripts/generate-sites-config.ts` 실행하여 `config/sites.json` 수동 생성 및 결과 확인
- [x] 코드 리뷰 문서 (`038-fix-sites-config-generation-path.review.md`) 작성
- [x] 결과보고서 (`038-fix-sites-config-generation-path.walkthrough.md`) 작성
- [x] 자동 커밋 스크립트 실행

---

## Walkthrough

### 038-exclude-raw-pdf-from-conversion.walkthrough

# 결과보고: raw/ 디렉토리 PDF 변환 제외 필터링

## 개요

`apps/ebook/src/process.py`에서 `--pdf2html` 및 `--html2md` 모드가 `data/ebook/raw/` 디렉토리 내 원본 PDF까지 변환 대상에 포함시키는 버그 수정.

## 작업 내역

1. **문제 분석**: `process.py` L69, L118에서 `**/*.pdf`, `**/*.html` 재귀 glob 사용으로 `raw/` 하위 파일도 검색됨을 확인
2. **버그 수정**: glob 수집 직후 `"raw" not in p.resolve().parts` 조건으로 필터링 라인 추가 (L71-72, L123-124)
3. **문서화**: 리뷰/태스크/결과보고 문서 세트 작성

## 결과

- `--pdf2html all`: raw/ 내 PDF 제외됨
- `--html2md all`: raw/ 내 HTML 제외됨
- `--split`/`--pdf2md`: 기존과 동일 (영향 없음)

### 038-fix-sites-config-generation-path.walkthrough

# 🏁 Walkthrough: Fix Static Sites Configuration Generation Path

이 문서는 뷰어의 Meilisearch 인덱스 404 예외 해결 과정의 최종 조치 결과를 담고 있습니다.

## 1. 완료된 작업
- `apps/crawler/src/scripts/generate-sites-config.ts` 의 출력 파일 생성 경로를 루트 `config/sites.json` 으로 변경 완료.
- 설계 및 리뷰 문서화 세트 마련.

## 2. 검증 방법 안내
- 정적 설정 파일을 재생성하기 위해 호스트(로컬)에서 아래 명령어를 수동으로 1회 실행합니다.
  ```bash
  npx ts-node apps/crawler/src/scripts/generate-sites-config.ts
  ```
- 이후 뷰어 서비스 이미지를 재빌드하여 신규로 생성된 `config/sites.json`을 컨테이너 내부에 탑재합니다.
  ```bash
  make rebuild ms-reindex SITE=linkedin
  ```
- 뷰어 웹 대시보드에서 `LinkedIn Jobs`를 클릭했을 때 Meilisearch 404 에러 없이 데이터 목록이 정상 노출되는지 확인합니다.

---

