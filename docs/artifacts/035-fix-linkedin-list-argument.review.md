# 🔍 Code Review: Fix LinkedIn List Scraper Argument Handling

## 1. 개요
- **목적**: `make li-list` 구동 시 인자로 페이지 번호(`1`) 등이 넘어가며 `fs.existsSync("1")` 오류가 발생하던 현상을 조치
- **유형**: Bugfix (버그 수정)

## 2. 변경 내용 및 자가 진입점 평가
- [List.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/sites/linkedin/jobs/List.ts#L481-L494)에서 `process.argv[2]`가 숫자인 경우(예: `"1"`) 이를 설정 파일명 대신 기본 설정 파일인 `'config/config.json'`으로 매핑합니다.
- 이에 따라 `cli-list.ts` 등에서 `--page 1`과 같이 인자를 넘기더라도 정상 작동하게 됩니다.

## 3. 평가
- **올바름(Correctness)**: 숫자인 입력값을 거르는 간단하고 명확한 예외 처리로, 기존 흐름(설정 파일이 지정된 경우 설정 파일을 우선 사용하는 흐름)을 훼손하지 않습니다.
- **가독성(Readability)**: 정규표현식 `/^\d+$/`을 사용하여 간결하게 처리하였습니다.
- **아키텍처(Architecture)**: CLI 인자 처리 과정에서의 불일치를 유연하게 해소하였습니다.
