# Tasks: 서적 경로 직접 지정 입력창 제거 (Remove Custom Path Input)

## 📋 구현 작업 목록

- [x] **1. 프론트엔드 입력 요소 및 상태 코드 제거**
  - 파일: [ExporterView.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ExporterView.vue)
  - 내용:
    - `customPath` 선언부(`const customPath = ref<string>('');`) 제거.
    - `startExport` 함수 내 `bookPath`를 `selectedBook.value`로 고정하고, `customPath` 대체 로직 삭제.
    - 템플릿(HTML) 내의 `"또는 아래에 전체 경로를 직접 지정할 수 있습니다:"` 주석/안내 텍스트와 `<input v-model="customPath">` 입력 필드 엘리먼트 제거.
