# Gitea & Vikunja 로컬 인프라 구축 결과보고서 (Traefik 연동 보완 반영)

## 변경 사항 및 구성 완료 요약

Traefik 프록시망 내부에서 Gitea 및 Vikunja 컨테이너의 도메인을 찾지 못하는 문제를 해결하기 위해 공통 네트워크 통신 및 구동 의존성을 명세하였습니다.

1. **Gitea 컴포즈 파일 보완**:
   - `depends_on: traefik (condition: service_healthy)`를 명세하여 Traefik 프록시 준비 완료 후 기동되도록 강제했습니다.
   - `networks.default.aliases`를 명세하여 프록시 내부망에서 `gitea.localhost`로 컨테이너를 올바르게 색인할 수 있도록 보완했습니다.
2. **Vikunja 컴포즈 파일 보완**:
   - `depends_on: traefik (condition: service_healthy)`를 명세하여 Traefik 프록시 준비 완료 후 기동되도록 강제했습니다.
   - `networks.default.aliases`를 명세하여 프록시 내부망에서 `vikunja.localhost`로 컨테이너를 올바르게 색인할 수 있도록 보완했습니다.

---

## 🚀 로컬 컨테이너 재빌드 및 구동 명령어 안내

규칙 1번(임의 셸 실행 금지) 및 12번(환경 제어 공동 위임)에 따라, 컨테이너 구동은 사용자가 수동으로 실행해주셔야 합니다. 네트워크 사양이 변경되었으므로 아래 명령어로 **컨테이너 재생성 구동**을 수행해 주시기 바랍니다.

```bash
docker compose -p scraper --profile tools up -d --force-recreate
```

기동 완료 후 아래 도메인들로 정상적인 로그인을 시도하실 수 있습니다.
- **Gitea**: [https://gitea.localhost/](https://gitea.localhost/) (ID: `admin` / PW: `admin12345`)
- **Vikunja**: [https://vikunja.localhost/](https://vikunja.localhost/)
