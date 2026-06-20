# Plan: align-all-imports

모노레포 개편 이전의 레거시 디렉토리 계층 구조 잔재로 인해 `src/` 하위 전역 소스 파일에 퍼져있던 데이터베이스, 공통 설정, 유틸리티 임포트의 경로 오정합 현상을 전수 복구(Bugfix)하여 컴파일 무결성을 보장하는 계획입니다.

## User Review Required
> [!IMPORTANT]
> - `core/`, `sites/`, `tools/` 내부의 총 18개 파일에서 임포트 경로의 상대 계층 수준이 1단계씩 축소 정비됩니다.
> - 이미지 내부 및 로컬 구동 시 `Cannot find module` 오류가 모두 영구 해결됩니다.

## Proposed Changes

### 1. Relative Import Path Corrections
- **`[MODIFY]`** `src/core/` 하위 소스 파일 3개:
  - `BasePipeline.ts`, `BaseRefreshConvert.ts`, `BaseRefreshUrls.ts` 내부의 `../../database` ➡️ `../database` 교정
- **`[MODIFY]`** `src/sites/` 하위 소스 파일 14개:
  - 각 깊이(Depth)에 맞춰 상속 레벨이 1단계씩 초과 설정되어 있던 상대 경로 임포트 구문들(`database`, `config`, `utils` 관련)을 전수 교정
- **`[MODIFY]`** `src/tools/browser/open.ts`:
  - `../../config/AppConfig` ➡️ `../config/AppConfig` 교정

---

## Verification Plan

### Manual Verification
- 수집기 실행 검증:
  - `make list` 명령을 통하여 `gpters_news` 크롤러가 컴파일 에러 없이 정상 구동을 완수하는지 검증합니다.
