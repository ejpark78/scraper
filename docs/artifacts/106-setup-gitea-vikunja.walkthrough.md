# Gitea & Vikunja 로컬 인프라 구축 결과보고서 (Makefile 단축 타겟 추가 반영)

## 변경 사항 및 구성 완료 요약

Gitea와 Vikunja 서비스의 신속한 가동과 중지를 위해 `scripts/tools/tools.mk` 파일 내에 Make 타겟을 완비하였습니다.

1. **Gitea 단축 명령어 추가**:
   - `make up-gitea`: Gitea 단독 가동 명령어
2. **Vikunja 단축 명령어 추가**:
   - `make up-vikunja`: Vikunja 단독 가동 명령어
3. **전체 도구 연동**:
   - `make up-tools` 실행 시 Gitea와 Vikunja가 자동으로 함께 기동되도록 통합 처리하였습니다.
   - `make down-tools` 실행 시에도 함께 컨테이너가 내려가도록 정비하였습니다.

---

## 🚀 로컬 명령어 테스트 안내

규칙 1번(임의 셸 실행 금지) 및 12번(환경 제어 공동 위임)에 따라, 명령어 실행은 사용자가 수동으로 실행해주셔야 합니다. 터미널에서 다음 명령어를 실행하여 단축 타겟 작동 여부를 검증해 보실 수 있습니다.

```bash
make up-gitea
make up-vikunja
```
