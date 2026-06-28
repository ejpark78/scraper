# 🚶‍♂️ 결과보고서: Gitea tea CLI 호스트 설치 (112-install-tea-cli.walkthrough.md)

이 문서는 Gitea `tea` CLI 도구 설치의 실행 결과 및 사용 가이드를 제공합니다.

---

## 1. 구현 완료 사항
* macOS 호스트 환경에 Homebrew를 이용한 `tea-cli` 패키지 설치를 진행하고 버전을 검증하였습니다.

---

## 2. 사용 가이드 (Gitea 연동 설정)
설치 완료 후 로컬 Gitea 서버와 로그인 연동을 위해 사용자가 직접 터미널에서 다음 명령어를 실행하여 계정을 등록해야 합니다.

1. Gitea 인스턴스 정보 추가:
   ```bash
   tea login add
   ```
2. 다음과 같이 입력을 요청받게 됩니다:
   * **URL**: `https://gitea.localhost` (혹은 `https://gitea.127.0.0.1.nip.io`)
   * **Token**: Gitea 웹페이지 ➡️ 사이트 설정 또는 개인 정보 메뉴에서 생성한 액세스 토큰(Access Token) 값을 입력합니다.
   * **Name**: 연동할 인스턴스의 별칭 (예: `local`)
