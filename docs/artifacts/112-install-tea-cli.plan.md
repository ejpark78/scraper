# 📝 계획서: Gitea tea CLI 호스트 설치 (112-install-tea-cli.plan.md)

이 계획서는 Gitea의 공식 커맨드라인 도구인 `tea` CLI를 macOS 호스트 환경에 설치하여 에이전트 및 사용자가 터미널에서 Gitea 인스턴스를 직접 제어할 수 있도록 구성하는 계획을 정의합니다.

---

## 1. 개요 & 목적
* Gitea 이슈, PR, 저장소 등을 호스트 터미널 환경에서 효율적으로 연동 및 추출하기 위해 공식 CLI 도구인 `tea-cli`를 설치합니다.

---

## 2. 설치 및 검증 계획

### A. 설치 방식
* macOS 환경의 공식 패키지 관리자인 **Homebrew**를 통해 `tea-cli`를 설치합니다.
* 설치 명령어:
  ```bash
  brew install tea-cli
  ```

### B. 검증 방식
* 설치 후 버전을 확인하여 설치 완료 여부를 검증합니다.
  ```bash
  tea --version
  ```

---

## 3. 사용자 실행 및 동의 요구사항
* 셸 명령어 실행 규칙에 따라 `brew install tea-cli` 명령어의 실행 승인을 획득하여 설치를 진행합니다.
