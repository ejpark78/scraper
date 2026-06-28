# 🏁 작업 목록: Gitea Actions 추가 설정 (111-setup-gitea-actions.task.md)

- [ ] `docker/tools/gitea/compose.yml` 파일 수정
  - [ ] `gitea` 서비스에 `GITEA__actions__ENABLED=true` 환경 변수 추가
  - [ ] `act_runner` 서비스 정의 추가
- [ ] Gitea Actions 활성화 적용을 위한 Gitea 컨테이너 리스타트 제안 (사용자 실행용 명령어 작성)
- [ ] Gitea Actions Runner 등록 절차 가이드 작성 및 안내
- [ ] 작업 완료 후 Git 커밋 실행 (`commit-changes.sh`)
