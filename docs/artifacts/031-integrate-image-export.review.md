# Code Review: 내보내기 시 로컬 이미지 연동 및 업로드 구현 (Integrate Local Image Export)

## 📌 변경 요약
- **목적**: 마크다운 서적 파일 내에 기술되어 있는 로컬 이미지 파일들의 경로 깨짐 현상을 근원적으로 방지하기 위해, 이미지를 Joplin 리소스로 선제 등록하고 본문의 링킹을 동적 치환하는 기능을 통합했습니다.
- **백엔드 변경**: 지정 도서 폴더의 이미지들을 안전하게 MIME 헤더와 함께 서빙하는 `GET /api/exporter/image` 신설.
- **프론트엔드 변경**:
  - `uploadImageToJoplin` 헬퍼 함수를 추가하여 백엔드에서 이미지 Blob을 확보한 후 브라우저 단에서 직접 Joplin `POST /resources`로 파일 업로드 수행.
  - 마크다운 파싱용 `imgRegex = /!\[(.*?)\]\((images\/.*?)\)/g` 정규식을 활용해 감지된 이미지를 루프를 돌며 동적 치환 (`![title](:/resource_id)`).

## 🔍 핵심 코드 분석

### 1. 백엔드 이미지 전송 보안 강화
[exporter.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/api/routes/exporter.ts)
```typescript
const sanitizedBookPath = path.basename(pathName);
const sanitizedImagePath = imagePath.replace(/\.\./g, '');
const resolvedImagePath = path.join(booksDir, sanitizedBookPath, sanitizedImagePath);
```
- **리뷰**: `path.basename` 및 `..` 문자열의 정규식 일괄 필터링을 도입하여 호스트 컴퓨터 파일 시스템 상위 디렉터리 접근(Directory Traversal Vulnerability) 가능성을 미연에 차단했습니다.

### 2. 프론트엔드 Blob 획득 및 Multipart Form 구성
[ExporterView.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ExporterView.vue)
```typescript
const formData = new FormData();
formData.append('data', blob, filename);
formData.append('props', JSON.stringify({ title: filename }));
```
- **리뷰**: Joplin 리소스 생성 포맷 규격을 준수하여 `multipart/form-data` 바디에 `data` 바이너리 스트림과 `props` 객체 문자열 정보를 결합해서 보냅니다. 중복 업로드로 인한 용량 낭비를 막고자 단일 챕터 내에서 동일 이미지 주소에 대해 `imageCache` Map을 적용해 단 1회만 업로드되도록 최적화했습니다.

## 🛠️ 검증 항목 및 자가 진단
- [x] MIME 타입 판별: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg` 확장자를 적절히 지원하는 지 분기 처리 적용 확인.
- [x] 예외 핸들링: 특정 이미지가 손상되었거나 누락되어 업로드가 실패하더라도 전체 책 내보내기 루프가 붕괴되지 않고 경고성 로그만 띄우며 다음 이미지/챕터로 스킵 및 회복하도록 안전 장치(try-catch) 탑재 확인.
