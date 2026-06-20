# Code Review: 내보내기 설정 카드 최소 높이 조정 (Adjust Card Height)

## 📌 변경 요약
- **목적**: 불필요하게 큰 설정 카드 최소 높이 디자인 스펙을 입력창 컴포넌트 축소 볼륨에 발맞춰 콤팩트하게 교정했습니다.
- **주요 코드**: [ExporterView.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ExporterView.vue)

## 🔍 핵심 코드 분석

### 1. 카드의 스타일 변경부
```html
<div class="queue-section-card" style="... min-height: 470px;">
```
- **리뷰**: 
  - 서적 경로 지정 인풋 필드 제거로 인해 폼 요소들의 높이 합이 작아졌으므로, 최소 높이를 기존 `615px`에서 `470px`로 낮춰 과도한 여백 낭비를 해소했습니다.
  - 이로써 우측 콘솔 로그 카드의 높이(`max-height: 480px`, `min-height: 320px`)와도 시각적인 세로 균형이 수려하게 유지됩니다.

## 🛠️ 검증 항목 및 자가 진단
- [x] 오타 교정 검증: `min-height: 470px;` 인라인 CSS 선언 형식에 문법 에러가 없는지 꼼꼼히 확인 완료.
- [x] 반응형 및 공간적 조화도: 레이아웃 카드 내부의 스크롤 영역(`settings-scroll-area`)이 찌그러지거나 잘려 보이지 않는지 재차 검증 완료.
