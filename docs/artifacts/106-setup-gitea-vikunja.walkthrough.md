# Gitea & Vikunja 로컬 인프라 구축 결과보고서 (macOS 호환성 보완 반영)

## 변경 사항 및 구성 완료 요약

macOS 환경에서 볼륨 마운트 시의 잠재적인 경로 매핑 에러와 파일 포맷 에러(/etc/timezone 등)를 해결하도록 조치하였습니다.

1. **Gitea 볼륨 마운트 수정**:
   - macOS 호환성을 저해하는 `/etc/timezone` 및 `/etc/localtime` 볼륨 바인딩을 제거했습니다.
   - 컨테이너 내부 타임존은 환경변수 `TZ=Asia/Seoul`을 통해 안정적으로 주입되도록 보장했습니다.
   - 호스트 마운트 상대 경로를 루트 기준 격리된 디렉토리인 `./docker/tools/gitea/data`로 명확화하였습니다.
2. **Vikunja 볼륨 마운트 수정**:
   - 호스트 마운트 상대 경로를 루트 기준 격리된 디렉토리인 `./docker/tools/vikunja/data` 및 `./docker/tools/vikunja/db`로 명확화하였습니다.
3. **루트 compose.yml 연동**:
   - 기존의 `include` 지시자를 통한 중앙 관리 구조를 그대로 유지하였습니다.

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
