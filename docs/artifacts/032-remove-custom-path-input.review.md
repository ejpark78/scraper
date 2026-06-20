# Code Review: 서적 경로 직접 지정 입력창 제거 (Remove Custom Path Input)

## 📌 변경 요약
- **목적**: 화면 UI 간소화 및 사용자가 입력 상자로 인해 혼동하는 현상을 막기 위해 서적 절대 경로 입력 창을 영구히 삭제했습니다.
- **주요 코드**: [ExporterView.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ExporterView.vue)

## 🔍 핵심 코드 분석

### 프론트엔드 상태 변수 및 로직 단작화
```typescript
// 제거 전
const bookPath = customPath.value.trim() || selectedBook.value;

// 제거 후
const bookPath = selectedBook.value;
```
- **리뷰**: `customPath` 변수 관련 참조를 제거함으로써 불필요한 리액티브 상태 할당을 줄였습니다. 이제 `bookPath`는 전적으로 `selectedBook.value` (선택된 드롭다운 값)만 바라보도록 안전하게 통일되었습니다.
- **HTML 템플릿**: `"또는 아래에 전체 경로를 직접 지정할 수 있습니다:"` 텍스트 단락과 `customPath` 인풋 필드를 제거하여, 스크롤바가 생기는 영역의 스페이스를 추가 확보하고 디자인 가시성을 향상시켰습니다.

## 🛠️ 검증 항목 및 자가 진단
- [x] 변수 잔존성 체크: 컴포넌트 내에 `customPath`에 대한 미사용 선언이나 남은 워처가 없는지 스크립트 전반 검증 완료.
- [x] UI 렌더링 검증: 드롭다운 서적 스캔 필드만 정상적으로 표시되고 동작에 지장 없는지 구조 검토 완료.
