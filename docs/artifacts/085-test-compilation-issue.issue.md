# 🚨 [Issue] 테스트 코드 모듈 컴파일 격리 실패 분석서

본 장애 분석서는 `apps/crawler` 환경의 단위 테스트 코드 실행 도중 발생한 `TSError` (Cannot find module 'cheerio') 현상의 원인을 규명하고 해결 방법을 기술합니다.

---

## 💥 현상 개요

- **발생 명령어**: `npm run test:sites` (in `apps/crawler`)
- **에러 메시지**:
  ```
  TSError: ⨯ Unable to compile TypeScript:
  tests/sites/dailydoseofds/Converter.test.ts(13,26): error TS2307: Cannot find module 'cheerio' or its corresponding type declarations.
  tests/sites/dailydoseofds/Converter.test.ts(14,29): error TS2307: Cannot find module 'turndown' or its corresponding type declarations.
  ```

---

## 🔍 원인 분석

### 1. npm workspaces 미설정에 따른 의존성(node_modules) 격리
- 현재 프로젝트는 모노레포 구조를 차용하고 있으나, 루트 레벨의 `package.json`에는 `cheerio`, `turndown` 등 실제 크롤러 코드의 종속성 라이브러리가 제외되어 있고 오직 `apps/crawler/package.json`에만 설치 대상이 명시되어 있습니다.
- `apps/crawler` 내부에서 명시적 의존성 설치(`npm install`)를 실행하지 않아, 로컬 영역에 `./node_modules` 디렉토리나 관련 타입 정의가 존재하지 않았습니다.

### 2. 최상위(Global) ts-node 컴파일러의 로컬 tsconfig 미매핑
- `package.json`의 scripts에 정의된 `"test:sites"` 스크립트는 `ts-node`를 직접 실행하고 있었습니다.
- 이 경우 `ts-node`는 `apps/crawler/tsconfig.json`을 자동으로 추적하지 못하고 최상위 루트 경로 혹은 Fallback 경로를 기준삼아 컴파일하므로, 로컬 의존성 해석에 연이어 실패하게 되었습니다.

---

## 🛠️ 조치 및 해결 방법

1. **테스트 프로젝트 옵션 명시화**:
   - `apps/crawler/package.json` 내부의 `ts-node` 호출 스크립트 전부에 `-P tsconfig.json` 옵션을 수동으로 명시하여, 무조건 로컬의 `tsconfig` 및 컴파일 타겟 범위를 따르도록 강제하였습니다.

2. **컴파일 포함 범위 갱신**:
   - [tsconfig.json](file:///Users/ejpark/workspace/scraper/apps/crawler/tsconfig.json)의 `"include"` 속성에 `"tests/**/*"` 경로를 추가 지정하여, 테스트 코드 영역까지 정상적으로 타입 스캔 범주에 속하도록 교정하였습니다.

3. **향후 해결책**:
   - 로컬 단위 테스트가 완벽히 통과하기 위해서는 `apps/crawler` 디렉토리 내부에서 로컬 종속성 패키지 설치(`npm install --prefix apps/crawler`)가 전행되어 로컬 의존성 환경이 완전하게 구성되어야 합니다.
