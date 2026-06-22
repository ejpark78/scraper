# Summary: 049-separate-agents-rules

> Squashed from: 049-separate-agents-rules.review.md 049-separate-agents-rules.task.md 049-separate-agents-rules.walkthrough.md

---

## Review

### 049-separate-agents-rules.review

# Review - AGENTS.md 규칙 분리 (apps/crawler, apps/viewer)

## 📋 검토 개요
- **작업명**: AGENTS.md 규칙 분리 및 모듈별 규칙 적용성 최적화
- **등급**: Major (설정 및 규칙 변경)
- **목적**: 루트 `AGENTS.md`에서 특정 애플리케이션 종속적 규칙을 각 모듈로 격리하여 컨텍스트 토큰 소비 절약 및 집중화된 가이드 제공

---

## 🔍 변경 상세 및 품질 검토

### 1. 전용 규칙 격리
- `apps/crawler/AGENTS.md` 및 `apps/viewer/AGENTS.md`를 신규 생성하여 각각에 해당하는 Docker 커맨드 예시, Playwright 버전 대응, 재귀 수집 제약 조건 및 전용 Skill Map 분리 배치 완료.

### 2. 루트 레벨 규칙 슬림화
- 루트 `AGENTS.md`에 포함되어 있던 7번 Docker 세부 예시, 15번 크롤러 전용 제약조건 등을 깔끔하게 제거.
- LaTeX 수식 화살표(`\longrightarrow`)를 직관적인 일반 텍스트 화살표(`->`)로 변환하여 마크다운 파서 및 LLM 인식 효율 향상.

### 3. 일관성 검증
- 전역 규칙과 서브 모듈 규칙 간의 모순 없음 확인.

---

## 🧪 테스트 시나리오 및 결과
- **확인 항목**: 각 AGENTS.md 파일의 포맷 및 정상 작성 여부 검증
- **결과**: `cat` 혹은 VS Code 뷰어를 통해 포맷 깨짐 및 오류 없이 완벽히 덮어쓰기 되었음을 최종 확인 완료.

---

## Task

### 049-separate-agents-rules.task

# Task - AGENTS.md 규칙 분리 (apps/crawler, apps/viewer)

## 📋 Todo List

- [ ] apps/crawler/AGENTS.md 신규 생성 <!-- id: 1 -->
- [ ] apps/viewer/AGENTS.md 신규 생성 <!-- id: 2 -->
- [ ] 루트 AGENTS.md 업데이트 (crawler, viewer 전용 규칙 제거) <!-- id: 3 -->
- [ ] CHANGELOG.md 업데이트 <!-- id: 4 -->
- [ ] `scripts/agents/commit-changes.sh` 실행 및 커밋 완료 확인 <!-- id: 5 -->

---

## Walkthrough

### 049-separate-agents-rules.walkthrough

# Walkthrough - AGENTS.md 규칙 분리 (apps/crawler, apps/viewer)

## 🎯 작업 목적
루트 `AGENTS.md` 파일에 집중되어 있던 `apps/crawler` 및 `apps/viewer`에 해당하는 개별 특화 규칙들을 각 서비스 하위 `AGENTS.md`로 물리적으로 격리하여, LLM 토큰 절약 및 패키지별 집중된 컨텍스트 조성을 완료했습니다.

---

## 🛠️ 수행 결과

### 1. 신규 규칙 파일 생성
- **[apps/crawler/AGENTS.md](file:///home/ejpark/workspace/scraper/apps/crawler/AGENTS.md)**:
  - Playwright 브라우저 의존성 불일치 대응법 명시
  - 재귀 스크랩 금지 및 1회성 스크랩 고정 규칙 명시
  - 크롤러 전용 Skill Map 바인딩
- **[apps/viewer/AGENTS.md](file:///home/ejpark/workspace/scraper/apps/viewer/AGENTS.md)**:
  - 호스트 마운트가 제한된 viewer의 빌드 및 배포 이미지 생성 지침 명시
  - `make up-viewer` 실행을 포함하는 환경 제어 페어 프로그래밍 위임 예시 명시

### 2. 루트 `AGENTS.md` 다이어트 및 문법 개선
- **[AGENTS.md](file:///home/ejpark/workspace/scraper/AGENTS.md)**:
  - 중복되거나 서브앱에 종속된 도커 커맨드 및 규칙 제거
  - `Documentation Lifecycle` 내 LaTeX 수식을 텍스트 화살표(`->`)로 변환하여 가시성 및 가독성 개선

### 3. 작업 이력 작성
- **[CHANGELOG.md](file:///home/ejpark/workspace/scraper/CHANGELOG.md)**: `[1.7.0] - 2026-06-23` 버전에 해당 규칙 격리 내역 추가

---

## 🏁 최종 상태 확인
- `apps/crawler/AGENTS.md`, `apps/viewer/AGENTS.md`, 루트 `AGENTS.md`가 유실된 번호 없이 모두 의도된 대로 깨끗하게 정리 완료되었습니다.

---

