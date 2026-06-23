# 064 - DESIGN.md (Stripi 디자인 가이드라인) 반영 코드 리뷰 문서

이 문서는 DESIGN.md 가이드에 따라 변경된 뷰어 프론트엔드 스타일 및 컴포넌트 마크업 코드의 디자인 가이드 준수 여부를 검토합니다.

## 디자인 가이드 대조 검증 항목

1. **컬러 스키마 준수 (Colors)**:
   - Primary Electric Indigo (`#533afd`), Press Indigo (`#2e2b8c`), Deep Navy Background (`#0d253d`)가 스타일 변수에 올바르게 주입되었는지 확인.
2. **버튼 둥글기 (Border Radius)**:
   - 버튼 컴포넌트(`btn-primary`, `btn-secondary` 등)에 `rounded.pill` (`9999px`) 지정을 위해 `border-radius: 9999px`가 정상 매핑되었는지 확인.
3. **타이포그래피 및 Tabular Figures**:
   - 대시보드의 숫자 테이블 및 통계 데이터에 `font-feature-settings: "tnum"`이 제대로 들어가 숫자들이 일렬로 정합성 있게 나열되는지 확인.
4. **글로벌 입력 폼 둥글기 및 콤보 박스**:
   - `custom-select-box`와 `form-input-text`에 `rounded.sm` (`6px`)이 올바르게 일치하여 렌더링에 이질감이 없는지 확인.
