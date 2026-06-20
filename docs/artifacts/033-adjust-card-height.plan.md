# Plan: 내보내기 설정 카드 최소 높이 조정 (Adjust Card Height)

## 배경 및 목적
서적 경로 입력 필드 및 문구가 제거됨에 따라 내보내기 설정 폼 카드의 세로 크기가 상당히 여유로워졌습니다. 기존의 불필요하게 높은 최소 높이(`min-height: 615px`)를 콤팩트한 `min-height: 470px`로 하향 조정하여, 불필요한 스페이스 낭비를 줄이고 보다 균형 잡힌 레이아웃을 구현합니다.

## 변경 계획

| 파일 경로 | 액션 | 상세 설명 |
| :--- | :--- | :--- |
| `apps/viewer/src/frontend/src/views/ExporterView.vue` | 수정 | 설정 폼을 담은 외부 엘리먼트(`.queue-section-card`)의 인라인 스타일 `min-height: 615px;`를 `min-height: 470px;`로 변경. |

## 기대 효과
- 화면 요소 축소에 따른 상하 여백의 균형을 맞추고, 불필요하게 낭비되던 화면 높이를 개선함.
