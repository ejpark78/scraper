# Walkthrough: remove-workspace-mount

사이트별 실행 스크립트에서 불완전성을 유발하던 런타임 수동 볼륨 마운트를 배제하고 컴파일 오류를 해결(Bugfix)한 변경 결과 보고서입니다.

## 변경 결과 요약

### 1. 수동 볼륨 마운트 제거 및 기동
- `scripts/sites/` 하위의 모든 `.mk` 파일들(9개) 내 `docker compose run` 호출부에서 `$(WORKSPACE_MOUNT)` 제거 완료.
- [scripts/environments.mk](file:///home/ejpark/workspace/scraper/scripts/environments.mk) 상의 `WORKSPACE_MOUNT` 변수 정의 삭제 완료.
- 컨테이너가 빌드 이미지 내부에 저장된 온전한 `tsconfig.json` 파일 참조로 실행되도록 정형화 완료 (Bugfix).

### 2. 관련 문서 작성
- [Plan](file:///home/ejpark/workspace/scraper/docs/plans/remove-workspace-mount.md)
- [Review](file:///home/ejpark/workspace/scraper/docs/reviews/remove-workspace-mount.md)
- [Task List](file:///home/ejpark/workspace/scraper/docs/reviews/remove-workspace-mount.task.md)

---

## 검증 (Verification)
- `make list` 명령어를 통한 `gpters_news` 등 사이트 덤프 정상 동작 확인.
  - [x] 검증 명령 수행 완료 (성공)
