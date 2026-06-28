# 🚶‍♂️ 결과보고서: Gitea Actions 추가 설정 (111-setup-gitea-actions.walkthrough.md)

이 문서는 Gitea Actions 및 `act_runner` 추가 설정의 완료 결과와 구동 방법을 설명합니다.

---

## 1. 구현 완료 사항
* `docker/tools/gitea/compose.yml` 파일 내에 Gitea Actions 활성화 변수 추가 완료.
* `act_runner` 서비스를 compose 파일에 명시하여 인프라 파이프라인에 통합 완료.

---

## 2. 구동 및 러너 등록 가이드 (User Actions)

서비스 구동 및 액션 러너 등록을 위해 사용자가 직접 실행해야 하는 절차는 다음과 같습니다.

### STEP 1: Gitea 컨테이너 리스타트
Gitea 설정을 적용하고 활성화하기 위해 Gitea 컨테이너를 재시작합니다.
```bash
docker compose -p scraper up -d gitea
```

### STEP 2: Actions Runner Token 획득
1. Gitea 웹페이지(`https://gitea.localhost`)에 관리자 계정(`gitea-admin` / `admin12345`)으로 로그인합니다.
2. 우측 상단의 프로필 클릭 후 **Site Administration (사이트 관리)**로 이동합니다.
3. 좌측 메뉴의 **Actions -> Runners (러너)** 메뉴를 선택합니다.
4. **Create new Runner (새 러너 생성)**을 눌러 토큰 값을 복사합니다.

### STEP 3: 토큰 파일 기록 및 act_runner 실행
1. 데이터 저장 디렉토리에 복사한 토큰을 파일로 저장합니다:
   ```bash
   mkdir -p data/.services/gitea/act_runner
   echo "YOUR_REGISTRATION_TOKEN_HERE" > data/.services/gitea/act_runner/token
   ```
2. 이제 `act_runner` 서비스를 시작합니다:
   ```bash
   docker compose -p scraper up -d act_runner
   ```

이후 Gitea 관리자 페이지의 Runners 목록에 `local-runner`가 등록된 것을 확인하실 수 있습니다.
