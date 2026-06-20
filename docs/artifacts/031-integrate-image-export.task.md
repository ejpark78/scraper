# Tasks: 내보내기 시 로컬 이미지 연동 및 업로드 구현 (Integrate Local Image Export)

## 📋 구현 작업 목록

- [x] **1. 백엔드 이미지 서빙 API 구현**
  - 파일: [exporter.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/api/routes/exporter.ts)
  - 내용: `GET /api/exporter/image` 엔드포인트를 구현하여 서적 폴더 내의 지정된 상대 이미지 파일을 서빙합니다. 경로 유효성 검사 및 `..` 우회 방지를 적용합니다.

- [x] **2. 프론트엔드 마크다운 이미지 파싱 및 Joplin 리소스 업로드 연동**
  - 파일: [ExporterView.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ExporterView.vue)
  - 내용:
    - 챕터 전송 루프 내에서 마크다운 안의 이미지 패턴(`![image](images/...)`)을 정규식으로 감지.
    - 백엔드 이미지 API로부터 Blob 다운로드.
    - 브라우저에서 직접 Joplin 리소스 API(`POST /resources`)로 `multipart/form-data` 형식 파일 업로드 수행.
    - 생성된 리소스 ID를 사용해 마크다운의 이미지 링크 주소를 `:/resource_id` 형식으로 변환 후 노트 생성 요청 전송.
