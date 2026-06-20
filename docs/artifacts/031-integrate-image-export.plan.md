# Plan: 내보내기 시 로컬 이미지 연동 및 업로드 구현 (Integrate Local Image Export)

## 배경 및 목적
서적 마크다운 문서 내에 포함된 로컬 이미지(`images/some_img.png` 등)는 Joplin 내보내기 진행 시 단순 상대 경로 텍스트 정보로만 전송되어, Joplin 앱 내부에서는 이미지를 찾지 못해 깨진 이미지(엑스박스)로 표시되는 문제가 발생합니다.
이 문제를 해결하기 위해 백엔드에서 책 디렉토리 내의 이미지 파일을 반환해주는 API를 신설하고, 프론트엔드가 마크다운에서 이미지를 파싱하여 Joplin 리소스 API(`/resources`)로 자동 업로드 후 마크다운 본문의 경로를 Joplin 리소스 식별자(`:/resource_id`)로 치환하여 노트를 생성하도록 개선합니다.

## 변경 계획

| 파일 경로 | 액션 | 상세 설명 |
| :--- | :--- | :--- |
| `apps/viewer/src/api/routes/exporter.ts` | 수정 | 지정한 서적 디렉토리 내의 이미지 파일을 반환해주는 `GET /api/exporter/image` API 추가. 경로 조작 취약점(`..` 이용 탐색) 방어 적용. |
| `apps/viewer/src/frontend/src/views/ExporterView.vue` | 수정 | 1. 챕터 마크다운 전송 전에 이미지 경로(`images/...`)를 정규식으로 파싱.<br>2. 신설된 `GET /api/exporter/image` API로 이미지 Blob 데이터를 다운로드.<br>3. 다운로드한 Blob을 브라우저에서 직접 Joplin 리소스 API(`POST /resources`)로 업로드.<br>4. 응답으로 받은 리소스 ID를 사용해 마크다운 내 이미지 링크를 `![title](:/resource_id)` 구조로 자동 변경하여 노트를 전송. |

## 기대 효과
- 내보내기 완료 시 Joplin 노트 내에 서적 삽입 이미지들이 깨지지 않고 완벽하게 동기화되어 고해상도로 정상 렌더링됨.
