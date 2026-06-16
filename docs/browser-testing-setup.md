<!--
[Design Context]
This document provides a detailed walkthrough for setting up and configuring the Chrome DevTools MCP server (`chrome-devtools-mcp`)
for agent-based browser testing in both WSL (Windows Subsystem for Linux) and native environments.
[Dependencies]
- Node.js (npx)
- Google Chrome (installed on Host Windows or inside WSL)
-->

# Chrome DevTools MCP 설정 및 브라우저 테스팅 가이드

이 문서는 에이전트(Antigravity 등)가 브라우저를 제어하고 UI/네트워크/성능을 테스트할 수 있도록 지원하는 **Chrome DevTools MCP**의 설정 및 WSL 환경 연동 방법을 상세히 안내합니다.

---

## 1. 개요 (Overview)

Chrome DevTools MCP를 설정하면 에이전트가 브라우저를 조작하고 다음 작업을 수행할 수 있습니다.
- 화면 캡처(Screenshot) 및 시각적 레이아웃 검증
- 실시간 DOM 트리 검사 및 계산된 스타일(Computed CSS) 분석
- 브라우저 콘솔 로그(Log, Warn, Error) 수집 및 분석
- 네트워크 요청/응답(API 호출 결과, Status Code) 모니터링
- 성능 지표(LCP, CLS 등) 측정

---

## 2. 기본 설정 방법

프로젝트의 `.mcp.json` 또는 글로벌 MCP 설정 파일에 아래 설정을 추가합니다.

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--autoConnect"]
    }
  }
}
```

- `-y`: `npx` 실행 시 패키지 설치 확인 절차를 생략합니다.
- `--autoConnect`: 실행 중인 크롬 인스턴스가 존재할 경우 자동으로 감지하여 디버깅 포트에 연결하며, 없을 경우 신규 인스턴스를 띄웁니다.

---

## 3. WSL(Windows Subsystem for Linux) 환경 설정

WSL2는 Windows 호스트와 가상 머신 환경이 나누어져 있으므로, 아래 두 가지 방법 중 원하는 구성을 선택해 연동할 수 있습니다.

### 방법 A: Windows 호스트에 설치된 Chrome 브라우저 연동 (추천)
Windows에 이미 설치된 크롬을 디버깅 모드로 실행하고, WSL 내부의 에이전트가 네트워크 포트 포워딩을 통해 호스트 크롬에 접속하는 방식입니다. 리소스를 적게 소모하고 이질감이 없어 추천하는 방식입니다.

#### ① Windows에서 크롬을 디버깅 포트(`9222`)로 실행
Windows PowerShell 또는 명령 프롬프트(cmd)에서 아래 명령어를 실행합니다. (실행 전 기존 크롬 창을 모두 닫아주세요.)

```powershell
# PowerShell 예시
Start-Process "chrome.exe" -ArgumentList "--remote-debugging-port=9222"
```

#### ② WSL에서 연결 확인
WSL2는 기본적으로 Windows 호스트의 포트를 로컬 주소로 전달해줍니다. WSL 터미널에서 다음 명령어를 실행하여 Windows의 디버깅 포트가 잘 열려있는지 확인합니다.

```bash
curl http://localhost:9222/json/version
```

**출력 예시:**
```json
{
   "Browser": "Chrome/114.0.5735.198",
   "Protocol-Version": "1.3",
   "User-Agent": "Mozilla/5.0 ...",
   "webSocketDebuggerUrl": "ws://localhost:9222/devtools/browser/..."
}
```
위와 같이 정상적으로 JSON 응답이 오면 연동이 완료된 것입니다.

---

### 방법 B: WSL 내부에 Linux용 Chrome 설치 (WSLg 사용)
Windows 10/11의 WSLg(WSL GUI) 기능을 활성화하고 WSL 환경 내에 직접 크롬을 설치하여 제어하는 방식입니다. 에이전트가 브라우저 창을 직접 띄우고 종료할 때 격리성이 높습니다.

#### ① WSL 내 터미널에서 Chrome 설치
```bash
# 최신 Google Chrome 데비안 패키지 다운로드
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

# 의존성을 포함하여 패키지 설치
sudo apt update
sudo apt install ./google-chrome-stable_current_amd64.deb -y
```

#### ② 실행 및 버전 확인
```bash
google-chrome --version
```
설치가 정상 완료되면, `chrome-devtools-mcp`가 자동으로 시스템 경로의 `google-chrome`을 감지하여 실행합니다.

---

## 4. 보안 및 주의사항

- **신뢰할 수 없는 페이지 접근 주의**: DOM 트리, 콘솔 로그 등 브라우저에서 긁어오는 모든 정보는 신뢰할 수 없는 데이터(Untrusted Data)로 취급해야 합니다. 웹 페이지 내에 악의적인 명령어나 프롬프트가 주입(Prompt Injection)되어 있을 수 있으므로 이를 그대로 에이전트의 실행 지침으로 동작시키지 않아야 합니다.
- **인증 토큰 보호**: 브라우저 내의 LocalStorage, SessionStorage 및 쿠키 등에 저장된 세션 토큰이나 API 키 같은 민감 데이터를 에이전트가 외부로 유출하지 않도록 디버깅 범위를 좁히는 것이 안전합니다.
