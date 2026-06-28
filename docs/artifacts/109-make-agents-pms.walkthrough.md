# 🚀 109-make-agents-pms.walkthrough.md

이 문서는 Gitea 및 Vikunja PMS 동기화 유틸리티(`make agents-pms`) 구현 결과 보고서입니다.

---

## 🎯 구현 성과 요약

1. **Gitea & Vikunja 자동 연동 스크립트 작성**: 
   * `.agents/scripts/sync-pms.ts`에 REST API 기반의 동기화 기능을 구현했습니다.
   * `docs/artifacts` 내의 마크다운 아티팩트를 파싱하여 Gitea의 Issues와 Vikunja의 Tasks에 매핑합니다.
2. **소급 적용 및 멱등성 보장**:
   * 스크립트 실행 시 기존 아티팩트들을 모두 스캔하여 Gitea 및 Vikunja에 일괄 Upsert를 진행하므로, 과거 아티팩트들도 정상적으로 자동 정렬 및 상태 갱신됩니다.
3. **편리한 CLI 추상화**:
   * `.agents/scripts/agents.mk`에 `pms` 타겟을 연결하여 사용자가 쉽게 `make agents-pms`로 동작을 수행할 수 있게 하였습니다.
4. **환경 변수 가이드 템플릿 제공**:
   * `.env.example`에 연동 관련 설정 변수를 추가 완료하였습니다.

---

## 🛠️ 동작 방식 설명

* **Gitea**: 
  * 아티팩트의 접두사 번호 `###`를 읽고 `[SCR-###]` 포맷의 Gitea Issue를 생성 및 수정합니다.
  * Plan, Task, Walkthrough의 가용성에 따라 해당 이슈의 설명(Description) 및 코멘트에 아티팩트 상세 내용을 렌더링하고, Walkthrough 존재 여부에 따라 이슈를 자동으로 열거나(Open) 닫습니다(Closed).
* **Vikunja**:
  * 지정된 프로젝트 명 내에 `Planned`, `In Progress`, `Done` 버킷을 확인하고, 아티팩트 상태(Plan만 ➡ Planned, Task ➡ In Progress, Walkthrough ➡ Done)에 따라 카드를 알맞은 버킷으로 자동 이동시킵니다.
* **인증 및 통신**:
  * 자체서명 SSL 오류를 우회하기 위해 `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` 처리를 포함했습니다.

---

## 🚦 사용 방법 및 검증 안내

이 기능을 사용하기 위해 사용자는 로컬 환경 변수를 채워야 합니다:

1. **Gitea API Token 발급**:
   * Gitea(예: `https://gitea.127.0.0.1.nip.io/`) 로그인 후 `설정 > 애플리케이션 > 토큰 생성`에서 권한을 가진 토큰을 발급합니다.
2. **Vikunja API Token 발급**:
   * Vikunja(예: `https://vikunja.127.0.0.1.nip.io/`) 로그인 후 `설정 > API 토큰`에서 새 토큰을 발급받습니다.
3. **.env 설정**:
   * 로컬 프로젝트 루트의 `.env` 파일에 아래 내용을 기입하고 토큰을 붙여넣습니다:
     ```bash
     GITEA_API_URL=https://gitea.127.0.0.1.nip.io/api/v1
     GITEA_API_TOKEN=발급받은_Gitea_토큰
     VIKUNJA_API_URL=https://vikunja.127.0.0.1.nip.io/api/v1
     VIKUNJA_API_TOKEN=발급받은_Vikunja_토큰
     ```
4. **실행**:
   * 터미널에서 다음 명령어를 실행하여 동기화를 테스트합니다:
     ```bash
     make agents-pms
     ```
