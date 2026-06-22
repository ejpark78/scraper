# 045-ebook-refactoring.review.md

이 문서는 `apps/ebook` 리팩토링 변경 사항에 대한 코드 리뷰 및 설계 검증을 수행합니다.

---

## 🔍 변경 개요
- **대상**: `apps/ebook`
- **구분**: Major (구조 변경 및 미사용 기능 삭제)
- **작성일**: 2026-06-22

---

## 🏗️ 아키텍처 및 설계 분석
기존에는 각 CLI 동작을 클래스(`EbookCommand`)화하여 매칭하는 커맨드 패턴 방식을 적용했습니다. 이는 확장을 염두에 둔 설계였으나, 명령어의 개수가 많지 않고 번역 기능이 폐기됨에 따라 가벼운 함수 호출 방식으로 변경하여 전체 코드를 단일 파일(`main.py`)로 축소 통합합니다.

### AS-IS 구조
```
src/
├── process.py (진입점)
├── commands.py (추상 커맨드 및 개별 구현 클래스)
├── translator.py (번역 로직)
└── translate_batch.py (번역 배치 로직)
```

### TO-BE 구조
```
src/
└── main.py (진입점 + CLI 로직 + 실행 함수 병합)
```

---

## 🛠️ 세부 변경 내용 및 파일 검토

1. **미사용 파일 제거**:
   - `translator.py`, `translate_batch.py` 제거.
   - `Makefile` 및 `pyproject.toml`에서 번역 관련 명령어 제거.
2. **진입점 모듈 변경**:
   - `process.py` -> `main.py`
3. **가벼운 구조화**:
   - `commands.py` 내의 각 작업 코드를 `main.py`에 내장 함수로 구현하여 파일 이동 오버헤드와 보일러플레이트 제거.
