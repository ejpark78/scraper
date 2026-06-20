# Walkthrough: 내보내기 설정 카드 최소 높이 조정 완료 보고 (Adjust Card Height)

## 🌟 작업 완료 개요
서적 경로 입력창 필드 삭제에 맞춰, 설정 폼이 있는 카드의 최소 높이(`min-height`)를 `615px`에서 `470px`로 상향 조정에서 적합한 크기로 정돈했습니다.

## 🛠️ 수정된 파일 목록
- **프론트엔드 뷰**: [ExporterView.vue](file:///home/ejpark/workspace/scraper/apps/viewer/src/frontend/src/views/ExporterView.vue)
  - `.queue-section-card` 외부 컨테이너의 최소 높이 값을 `470px`로 변경 완료.

---

## 🚀 적용 및 배포 방법 (Pair Programming 준수)

프론트엔드 빌드 및 기동을 위해 호스트 터미널에서 다음 명령어를 실행해 주세요:

```bash
# 뷰어 프론트엔드 빌드 및 기동
docker compose -p scraper up -d --build viewer-fe
```

---

## 🔍 수동 검증 가이드 (Verification Steps)
1. `https://viewer.localhost` (혹.은 `http://viewer.127.0.0.1.nip.io`) Exporter 대시보드 화면에 다시 접속합니다.
2. **레이아웃 확인**:
   - 설정 카드가 화면 하단으로 과하게 삐져나가지 않고 `470px` 수준으로 콤팩트하고 조화롭게 배치되는지 눈으로 확인합니다.
3. 내보내기 실행 테스트를 다시 시도하여 UI적인 정합성과 정렬이 예쁘게 유지되는지 관찰합니다.
