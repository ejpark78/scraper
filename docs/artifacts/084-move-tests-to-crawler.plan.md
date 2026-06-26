# 📝 [Plan] 테스트 디렉토리 모듈 격리 이동 계획서

본 계획서는 프로젝트 루트의 `tests/` 하위의 크롤러 테스트 코드들을 `apps/crawler/tests/` 경로로 이동시키고, 모노레포 격리 원칙에 부합하도록 경로를 재배치 및 수정하는 방안을 기술합니다.

---

## 📅 1. 작업 범위 및 대상 파일

1. **디렉토리 이동 (이동 위치)**
   - 기존: `/Users/ejpark/workspace/scraper/tests/...`
   - 신규: `/Users/ejpark/workspace/scraper/apps/crawler/tests/...`
   - 대상 폴더: `tests/sites` 하위 전체 (fixtures 및 readme 포함)

2. **임포트 경로 수정**
   - 대상 파일:
     - `apps/crawler/tests/sites/dailydoseofds/Converter.test.ts`
     - `apps/crawler/tests/sites/geeknews/Converter.test.ts`
     - `apps/crawler/tests/sites/linkedin/McpClient.test.ts`
     - `apps/crawler/tests/sites/linkedin/UrlManager.test.ts`
     - `apps/crawler/tests/sites/maily/josh/Converter.test.ts`
     - `apps/crawler/tests/sites/pytorch_kr/Converter.test.ts`
     - `apps/crawler/tests/sites/yozm/Converter.test.ts`
   - 수정 규칙:
     - `../../../src/crawler/sites/` ➡️ `../../../src/sites/` (모노레포 `apps/crawler` 내 로컬 `src` 폴더 상대 참조)

3. **`package.json` 실행 스크립트 수정**
   - 대상: [apps/crawler/package.json](file:///Users/ejpark/workspace/scraper/apps/crawler/package.json)
   - 수정 항목:
     - `test:urls`: `ts-node ../../tests/sites/...` ➡️ `ts-node tests/sites/...`
     - `test:mcp`: `ts-node ../../tests/sites/...` ➡️ `ts-node tests/sites/...`
     - `test:sites`: 상대 경로 백트래킹 제거 및 로컬 `tests/` 디렉토리 참조로 일원화

---

## 🛠️ 2. 이행 절차

1. **이동 실행**: `git mv` 또는 디렉토리 생성 및 복사를 통한 안전한 파일 재배치.
2. **코드 일괄 치환**: `tests/` 파일 내 소스 코드 임포트 상대 경로 일제 교정.
3. **설정 수정**: `apps/crawler/package.json`의 테스트 스크립트 경로 조정.
4. **검증**: `apps/crawler` 디렉토리 안에서 `npm run test:sites` 및 `npm run test:urls`를 구동하여 컴파일과 테스트 통과 여부 최종 검증.
