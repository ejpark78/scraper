# 📝 계획서 (093-fix-eslint-peer-deps.plan.md)

## 1. 개요
* **문제 상황**: `make build` 시 `viewer-mcp` (혹은 `viewer-api`) 빌드 과정에서 `npm install` 중 `eslint` (^9.21.0)와 `@eslint/js` (^10.0.1) 간의 peer dependency 충돌 발생.
* **해결 방안**: `@eslint/js` 버전을 `eslint` 버전인 `^9.21.0`로 낮추어 매칭합니다. 이 작업은 `apps/crawler`와 `apps/viewer` 패키지 모두에 적용됩니다.

## 2. 변경 대상 파일
1. `apps/crawler/package.json` ([package.json](file:///Users/ejpark/workspace/scraper/apps/crawler/package.json))
2. `apps/viewer/package.json` ([package.json](file:///Users/ejpark/workspace/scraper/apps/viewer/package.json))

## 3. 작업 절차
1. **피처 브랜치 생성 및 전환**: `develop` 브랜치 기준 `hotfix/093-fix-eslint-peer-deps` 생성 및 전환 (승인 필요)
2. **패키지 설정 수정**: `package.json` 파일의 `@eslint/js` 의존성을 `^9.21.0`로 수정
3. **로컬 검증**: `npm install` 및 `make build` 검증
4. **자동 Git 커밋 및 마무리**: `scripts/agents/commit-changes.sh` 실행
