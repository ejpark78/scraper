# Gitea & Vikunja 로컬 인프라 구축 결과보고서 (네트워크 단순화 반영)

## 변경 사항 및 구성 완료 요약

컴포즈 파일 내에서 개별 `networks` 및 에일리어스 설정을 명시하지 않고도 공용 디폴트 컴포즈 브릿지 네트워크 환경에서 문제없이 통신하도록 정비하였습니다.

1. **Gitea 컴포즈 파일 간소화**:
   - 불필요한 `networks.default.aliases` 선언 블록을 삭제했습니다.
2. **Vikunja 컴포즈 파일 간소화**:
   - 불필요한 `networks.default.aliases` 선언 블록을 삭제했습니다.
3. **영속성 및 의존성**:
   - `depends_on: traefik` 조건부 가동 설정은 유지하여 Traefik 프록시 로드 보장 구조를 지속 관리합니다.

---

## 🚀 로컬 컨테이너 재빌드 및 구동 명령어 안내

규칙 1번(임의 셸 실행 금지) 및 12번(환경 제어 공동 위임)에 따라, 컨테이너 구동은 사용자가 수동으로 실행해주셔야 합니다. 네트워크 사양이 변경되었으므로 아래 명령어로 **컨테이너 재생성 구동**을 수행해 주시기 바랍니다.

```bash
docker compose -p scraper --profile tools up -d --force-recreate
```

기동 완료 후 아래 도메인들로 정상 접속하실 수 있습니다.
- **Gitea**: [https://gitea.localhost/](https://gitea.localhost/)
- **Vikunja**: [https://vikunja.localhost/](https://vikunja.localhost/)
