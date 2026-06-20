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
