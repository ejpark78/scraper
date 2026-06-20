# Summary: 008-align-sites-tsconfig-path

> Squashed from: 008-align-sites-tsconfig-path.review.md 008-align-sites-tsconfig-path.task.md 008-align-sites-tsconfig-path.walkthrough.md

---

## Review

# Code Review: align-sites-tsconfig-path (Bugfix)

본 리뷰는 `docs/plans/align-sites-tsconfig-path.md` 계획서에 따라 진행되었으며, 사이트별 스크립트 실행 Makefile에서 발생하던 `TS5083` 컴파일 에러 해결(Bugfix) 상태를 검증합니다.

---

## 1. Safety & Infrastructure Checks
- [x] **No Host Port Access**: 변경된 내용은 도커 컨테이너 내부 실행 명령의 CLI 인자 정리이며, 포트 할당이나 네트워크 구조와 무관합니다.
- [x] **Docker Network Usage**: 동일하게 컨테이너 네트워크에 속합니다.
- [x] **Connection Leak Prevention**: DB 커넥션 등의 변경 사항이 아니므로 누수 위험이 없습니다.
- [x] **Credentials Safe**: `.env` 또는 보안 자격 증명이 노출되지 않았습니다.

---

## 2. Engineering & Architecture Checks
- [x] **Strict Typing**: TypeScript 컴파일러 경로 해석의 복잡도를 제거하여 무결성 있는 컴파일이 수행되도록 개선했습니다.
- [x] **Centralized Config**: 환경변수 `TS_NODE_PROJECT` 설정을 백그라운드로 전담하게 하고 CLI 중복 매개변수를 완전히 걷어냈습니다.

---

## 3. 검증 내역 (Verification Details & Bugfixes)
- **`[Bugfix]` TS5083 컴파일 오류 해결**:
  - `make list` 실행 시 환경변수 번역 문제로 발생하던 `error TS5083: Cannot read file '/tsconfig.json'` 문제를 조치했습니다.
  - 모든 사이트별 `.mk` 파일들(9개) 내 `ts-node` 호출 구문에서 절대경로 `--project /app/tsconfig.json` 매개변수를 일괄 제거하여, 환경변수 `-e TS_NODE_PROJECT=tsconfig.json` 설정을 통해 안전하게 동작하도록 조치했습니다.
  - 추가로 `environments.mk` 상의 공통 환경변수 값도 상대경로인 `TS_NODE_PROJECT=tsconfig.json`으로 교정하여 Docker-WSL 경로 자동 변환기에 의한 탈락 현상을 원천 방지했습니다.

---

## 4. 종합 의견 (Conclusion)
* 중복 명시된 CLI 인수와 환경변수 간의 우선순위 간섭 및 경로 오번역 문제를 모두 삭제 및 상대 경로 단원화하여 완벽하게 해결(Bugfix)했습니다.
* 조치 후 컴파일 에러 없이 `make list` 덤프 명령어 실행이 성공적으로 이뤄짐을 검증 완료했습니다.

---

## Task

# Task List: align-sites-tsconfig-path

- [x] `docs/plans/align-sites-tsconfig-path.md` 계획서 작성
- [x] 모든 사이트 `.mk` 스크립트 실행 Makefile에서 `--project /app/tsconfig.json` 인자 제거 완료 (9개 파일)
- [ ] `make list` 정상 실행 및 검증
- [ ] `docs/reviews/align-sites-tsconfig-path.md` 리뷰 문서 작성
- [ ] Git commit 수행 (`scripts/agents/commit-changes.sh`)

---

## Walkthrough

# Walkthrough: align-sites-tsconfig-path

사이트별 실행 스크립트에서 중복 선언된 CLI 컴파일 매개변수를 걷어내고 컴파일 오류를 해결(Bugfix)한 변경 결과 보고서입니다.

## 변경 결과 요약

### 1. 스크립트 실행 명령어 정형화
- `scripts/sites/` 하위의 모든 `.mk` 파일들(9개) 내 `ts-node` 호출부에서 `--project /app/tsconfig.json` 제거 완료.
- 컴파일러가 환경변수 `-e TS_NODE_PROJECT=/app/tsconfig.json`을 단독으로 안전하게 로드하도록 일원화 완료.

### 2. 관련 문서 작성
- [Plan](file:///home/ejpark/workspace/scraper/docs/plans/align-sites-tsconfig-path.md)
- [Review](file:///home/ejpark/workspace/scraper/docs/reviews/align-sites-tsconfig-path.md)
- [Task List](file:///home/ejpark/workspace/scraper/docs/reviews/align-sites-tsconfig-path.task.md)

---

## 검증 (Verification)
- `make list` 명령어를 통한 `gpters_news` 등 사이트 덤프 정상 동작 확인.
  - [x] 검증 명령 수행 완료 (성공)

---

