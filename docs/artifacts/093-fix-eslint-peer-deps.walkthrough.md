# 🏁 결과보고서 (093-fix-eslint-peer-deps.walkthrough.md)

## 1. 작업 개요
* **버그 종류**: Docker 빌드 시 `eslint` 버전(^9.21.0)과 `@eslint/js` 버전(^10.0.1) 간의 peer dependency 버전 충돌 문제
* **해결 방법**: `apps/crawler/package.json` 및 `apps/viewer/package.json`에 선언된 `@eslint/js` 버전을 `^9.21.0`로 조정하여 충돌을 해결함.

## 2. 세부 변경 사항
### 2.1 apps/crawler/package.json 수정
* [package.json](file:///Users/ejpark/workspace/scraper/apps/crawler/package.json#L70-L73) 수정:
  ```diff
  -    "@eslint/js": "^10.0.1",
  +    "@eslint/js": "^9.21.0",
  ```

### 2.2 apps/viewer/package.json 수정
* [package.json](file:///Users/ejpark/workspace/scraper/apps/viewer/package.json#L22-L25) 수정:
  ```diff
  -    "@eslint/js": "^10.0.1",
  +    "@eslint/js": "^9.21.0",
  ```

## 3. 검증 결과
* `make build`를 성공적으로 완료하여 Docker 컨테이너 이미지 빌드가 모두 에러 없이 종료되는 것을 확인함.
