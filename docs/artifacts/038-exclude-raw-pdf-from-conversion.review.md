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
