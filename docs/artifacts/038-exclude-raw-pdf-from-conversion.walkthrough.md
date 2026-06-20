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
