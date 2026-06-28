# Gitea & Vikunja 로컬 인프라 구축 결과보고서

## 변경 사항 및 구성 완료 요약

프로젝트의 태스크 관리와 Git 캐싱/미러링을 위해 두 가지 설치형(On-Premise) 도구를 로컬 Docker 환경에 구성 완료하였습니다.

1. **Gitea 구성 완료**:
   - 경로: `docker/tools/gitea/compose.yml`
   - 스토리지: SQLite3 내장 데이터베이스 사용 및 `./data` 폴더 마운트
   - 도메인: `gitea.localhost` 및 `gitea.127.0.0.1.nip.io`
2. **Vikunja 구성 완료**:
   - 경로: `docker/tools/vikunja/compose.yml`
   - 스토리지: SQLite3 내장 데이터베이스 사용 및 `./db`, `./data` 볼륨 마운트
   - 도메인: `vikunja.localhost` 및 `vikunja.127.0.0.1.nip.io`
3. **루트 compose.yml 연동**:
   - `include` 지시자를 통해 루트 레벨 컴포즈 파일에서 두 도구를 함께 관리하도록 등록 완료했습니다.

---

## 🚀 로컬 구동 및 검증 명령어 안내

규칙 1번(임의 셸 실행 금지) 및 12번(환경 제어 공동 위임)에 따라, 컨테이너 구동은 사용자가 수동으로 실행해주셔야 합니다. 아래의 명령어를 사용하여 서비스를 시작하실 수 있습니다.

### 1단계: 기존 Traefik 프록시 실행 (실행 중이지 않은 경우)
```bash
docker compose -p scraper up -d traefik
```

### 2단계: 신규 도구(Gitea & Vikunja) 구동
```bash
docker compose -p scraper --profile tools up -d
```
*(참고: 두 서비스는 `tools` 프로파일로 선언되어 있으므로, `--profile tools` 플래그를 붙이거나 개별 서비스명을 명시하여 실행합니다.)*

### 3단계: 웹 UI 접속 확인
- **Gitea**: [https://gitea.localhost/](https://gitea.localhost/)
- **Vikunja**: [https://vikunja.localhost/](https://vikunja.localhost/)

*(로컬 자가서명 SSL 인증서 경고가 발생할 경우 '위험을 감수하고 진행'을 선택하시면 됩니다.)*
