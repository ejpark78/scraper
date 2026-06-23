# 064 - DESIGN.md (Stripi 디자인 가이드라인) 반영 계획서

이 계획서는 `apps/viewer/DESIGN.md` 명세에 수록된 Stripi 디자인 시스템(Deep Navy background, Electric Indigo primary, 8px spacing, pill-radius buttons, tabular numerals)을 뷰어 애플리케이션 프론트엔드 전체에 일관되게 반영하기 위한 실행 계획입니다.

## Target Branch
- `develop` (또는 `feature/064-apply-design-spec`)

## User Review Required

> [!IMPORTANT]
> **디자인 개편 방향**
> - **색상 스키마**: 
>   - Primary: `#533afd` (Electric Indigo) / Press: `#2e2b8c` / Deep: `#4434d4`
>   - Background: `#0d253d` (Ink Navy) 및 `#1c1e54` (Brand Dark 900)
>   - Surface: `#ffffff` (Canvas), `#f6f9fc` (Canvas Soft), `#f5e9d4` (Canvas Cream)
> - **버튼**: Tight-radius pill shape (`border-radius: 9999px`), 패딩 `8px 16px` 적용.
> - **타이포그래피**: Display 텍스트에 thin weight(300), negative letter-spacing (`-0.2px` ~ `-1.4px`) 적용. 숫자 및 화폐 표기 영역에 `font-feature-settings: "tnum"` (Tabular Figures) 적용.
> - **컴포넌트 일관성**: 연결 방식 셀렉터(`custom-select-box`)와 텍스트 인풋 폼들의 세로 정렬 및 크기 일관성 보완.

---

## Proposed Changes

### 1. 글로벌 스타일 시스템 수정 (`apps/viewer/src/frontend/src/style.css`)
* CSS 변수 (`:root`)를 `DESIGN.md`에서 명시한 HSL/Hex 기반의 Palette로 수정합니다.
* `.form-select`, `.form-input-text` 등 글로벌 입력 필드의 스타일을 높이 `38px`, 배경색 `#161b26`, 보더 컬러 및 포커스 상태 트랜지션을 통일하여 정돈합니다.
* 카드 컴포넌트 (`.queue-section-card`, `.metric-card`)에 1px 반투명 보더 및 은은한 배경 blur를 적용합니다.

### 2. Joplin 연동 뷰어 디자인 수정 (`apps/viewer/src/frontend/src/views/ExternalView.vue`)
* 상단 연결 설정 카드의 UI 및 레이아웃을 `DESIGN.md`에서 제시한 form-group 스타일 및 pill button으로 통일합니다.
* 탭(Tabs)과 카드 및 버튼 요소에 `rounded.pill` (9999px)과 Electric Indigo (`#533afd`)를 테마 컬러로 정합성 있게 매칭합니다.

### 3. 대시보드 및 문서 뷰어 디자인 수정 (`views/DashboardView.vue` & `views/DocumentView.vue`)
* 대시보드의 Metric 수치 및 테이블 숫자 셀들에 `font-feature-settings: "tnum"`을 명시하여 Tabular-Figure 타이포그래피 정체성을 부여합니다.
* 각 뷰의 레이아웃 헤더 및 사이드바 토글 버튼에 일관된 트랜지션 효과를 부여합니다.

---

## Verification Plan
1. **Vite 컴파일 및 컨테이너 반영**:
   - `make viewer-build viewer-up` 실행을 승인받아 뷰어 서비스를 최신화합니다.
2. **UI 수동 검증**:
   - `https://viewer.localhost` (혹은 `http://localhost:3000`)에 접속하여 UI의 세로 정렬 및 둥글기 오차가 없는지 확인합니다.
   - 다크 글래스모피즘 테마의 색상 대비가 Stripi 디자인 원칙에 충실한지 브라우저에서 직접 시각적으로 점검합니다.
