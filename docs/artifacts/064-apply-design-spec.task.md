# 064 - DESIGN.md (Stripi 디자인 가이드라인) 반영 작업 리스트

이 태스크 문서는 `apps/viewer/DESIGN.md` 가이드라인에 맞춰 뷰어 프론트엔드를 개편하기 위한 세부 단계와 완료 여부를 추적합니다.

## 할 일 목록

- [ ] **글로벌 CSS 테마 구축** (`apps/viewer/src/frontend/src/style.css`)
  - [ ] CSS 변수 (`:root`)를 DESIGN.md의 Palette로 수정 (Indigo `#533afd`, Ink Navy `#0d253d`, Brand Dark `#1c1e54`)
  - [ ] 글로벌 입력 폼(`.form-select`, `.form-input-text`) 디자인 및 둥글기 오차 수정 (높이 38px, 배경색 `#161b26`, rounded 6px)
  - [ ] 카드 컴포넌트에 은은한 글래스모피즘 효과 부여
- [ ] **External (Joplin) 뷰 테마 변경** (`apps/viewer/src/frontend/src/views/ExternalView.vue`)
  - [ ] 상단 설정 영역의 select 박스와 input 텍스트 필드의 정렬 보완
  - [ ] 내보내기/가져오기 버튼에 pill shape (`border-radius: 9999px`) 및 Electric Indigo 테마 적용
- [ ] **대시보드 뷰 디자인 보완** (`apps/viewer/src/frontend/src/views/DashboardView.vue`)
  - [ ] 수집 통계 및 데이터 테이블 수치 정보 영역에 `font-feature-settings: "tnum"` 적용
  - [ ] 버튼 및 필터 요소들에 pill 형태 및 둥글기 반영
- [ ] **문서 뷰 디자인 보완** (`apps/viewer/src/frontend/src/views/DocumentView.vue`)
  - [ ] 테이블 및 수집 현황 탭, 카드 영역 테두리에 디자인 가이드라인 수치 일치
- [ ] **빌드 및 기동 확인**
  - [ ] `make viewer-build viewer-up` 실행하여 빌드가 정상 동작하는지 테스트
