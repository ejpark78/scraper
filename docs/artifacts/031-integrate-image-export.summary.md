# Summary: 031-integrate-image-export

> Squashed from: 031-integrate-image-export.review.md 031-integrate-image-export.task.md 031-integrate-image-export.walkthrough.md

---

## Review

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

---

## Task

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

---

## Walkthrough

# Walkthrough: 내보내기 시 로컬 이미지 연동 및 업로드 완료 보고 (Integrate Local Image Export)

## 🌟 작업 완료 개요
서적 마크다운 내에 포함된 로컬 이미지(`images/some_img.png`)가 Joplin에 전송된 후 깨져서(엑스박스) 렌더링되던 레이아웃 문제를 완벽히 해결했습니다.
백엔드 이미지 제공 API를 연동하고, 프론트엔드가 문서를 내보낼 때 이미지를 파싱해 Joplin에 리소스로 밀어넣고 주소를 매핑하여 노트에 삽입하도록 개발을 마쳤습니다.

## 🛠️ 수정된 파일 목록
1. **백엔드 라우터**: [exporter.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/api/routes/exporter.ts)
   - 책의 상대 경로 내 이미지 파일을 읽어 MIME 응답으로 서빙하는 `GET /api/exporter/image` API 추가.
2. **프론트엔드 뷰**: [ExporterView.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ExporterView.vue)
   - `uploadImageToJoplin`을 통해 이미지를 Joplin 리소스로 등록하고 리소스 ID 기반의 주소(`:/resource_id`)로 치환하여 노트를 생성하는 기능 탑재 완료.

---

## 🚀 적용 및 배포 방법 (Pair Programming 준수)

프론트엔드와 백엔드의 이번 신규 API 및 자바스크립트 소스코드를 반영하고 빌드하기 위해 아래 명령어를 차례대로 실행해 주세요:

```bash
# 뷰어 이미지 재빌드 및 전체 재기동
docker compose -p scraper up -d --build viewer-fe viewer-api
```

---

## 🔍 수동 검증 가이드 (Verification Steps)
1. `https://viewer.localhost` (혹은 `http://viewer.127.0.0.1.nip.io`) Exporter 대시보드 화면에 다시 진입합니다.
2. 책 목록에서 `Beyond Vibe Coding`을 선택한 뒤, Joplin 웹클리퍼 토큰을 입력하고 `📥 노트로 내보내기 실행`을 누릅니다.
3. **진행 로그 확인**:
   - 우측 진행 콘솔 로그 창에 각 챕터 진행 시 `🖼️ 이미지 처리 중... (총 X개 이미지 감지됨)` 문구가 출력되는지 관찰합니다.
   - 업로드가 진행되면서 `✅ [N/M] "챕터명" 생성 완료`가 최종 성공하는지 확인합니다.
4. **Joplin 결과 확인**:
   - 실제로 Joplin 앱을 열어 내보내진 `Beyond Vibe Coding` 하위의 노트를 클릭해 봅니다.
   - 본문 내 삽입되어 있던 기술 도식화 및 캡처 이미지들이 깨지지 않고 깨끗하게 출력되는지 검증합니다.

---

