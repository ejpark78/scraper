# Gitea & Vikunja 로컬 인프라 구축 결과보고서 (볼륨 표준 규격 맞춤 반영)

## 변경 사항 및 구성 완료 요약

모노레포 인프라 서비스 규격에 부합하도록 볼륨 마운트 경로를 `${HOST_PROJECT_PATH:-.}/data/.services/...` 구조로 리팩토링하였습니다.

1. **Gitea 볼륨 마운트 표준화**:
   - 호스트 마운트 경로: `${HOST_PROJECT_PATH:-.}/data/.services/gitea:/data`
2. **Vikunja 볼륨 마운트 표준화**:
   - 호스트 파일 경로: `${HOST_PROJECT_PATH:-.}/data/.services/vikunja/files:/app/vikunja/files`
   - 호스트 DB 경로: `${HOST_PROJECT_PATH:-.}/data/.services/vikunja/db:/db`
3. **영속 데이터 격리**:
   - 이를 통해 모든 로컬 컨테이너의 데이터 및 상태 저장 위치가 프로젝트 루트의 `data/` 폴더 하위로 통합 관리됩니다.

---

## 🚀 로컬 구동 및 검증 명령어 안내

규칙 1번(임의 셸 실행 금지) 및 12번(환경 제어 공동 위임)에 따라, 컨테이너 구동은 사용자가 수동으로 실행해주셔야 합니다. 아래의 명령어를 사용하여 서비스를 시작하실 수 있습니다.

### 1단계: 신규 도구(Gitea & Vikunja) 구동
```bash
docker compose -p scraper --profile tools up -d
```

### 2단계: 웹 UI 접속 확인
- **Gitea**: [https://gitea.localhost/](https://gitea.localhost/)
- **Vikunja**: [https://vikunja.localhost/](https://vikunja.localhost/)
