# Summary: 050-separate-changelogs

> Squashed from: 050-separate-changelogs.review.md 050-separate-changelogs.task.md 050-separate-changelogs.walkthrough.md

---

## Review

### 050-separate-changelogs.review

# Review - CHANGELOG.md 패키지별 격리 및 분리

## 📋 검토 개요
- **작업명**: CHANGELOG.md 패키지별 격리 및 분리
- **등급**: Major (설정 및 형상 관리 구조 변경)
- **목적**: 모노레포 구조에 적합하도록 각 서비스 디렉토리 하위로 변경 이력을 이격 분리하여 빌드/형상 관리 독립성 강화

---

## 🔍 변경 상세 및 품질 검토

### 1. 패키지별 변경 로그 이식
- `apps/crawler/CHANGELOG.md` 생성: 크롤러 스크립트 NPM 이전, sync, namespace 개편 이력 이전.
- `apps/viewer/CHANGELOG.md` 생성: Exporter 웹 연동, 브라우저 직접 내보내기 교정, Vue Router 마이그레이션 이력 이전.
- `apps/ebook/CHANGELOG.md` 생성: CLI 단순화 리팩토링, Ruff/Pytest 린트 및 단위 테스트 도입 이력 이전.

### 2. 마스터 인덱스 구축
- 루트 `CHANGELOG.md`: 개별 서브 모듈 상세 changelog 파일 상대 경로 링크 제공 및 연계.
- 전체 메이저 마일스톤 버전 릴리즈 요약화.

---

## 🧪 테스트 시나리오 및 결과
- **확인 항목**: 각 서브 디렉토리의 CHANGELOG.md 링크 접근 가능 여부 및 내용 정상 매핑 검증
- **결과**: 마크다운 파일들의 구조적 상대 경로 링크가 오류 없이 연결되어 원활히 열리는 상태를 확인 완료.

---

## Task

### 050-separate-changelogs.task

# Task - CHANGELOG.md 패키지별 격리 및 분리

## 📋 Todo List

- [ ] apps/crawler/CHANGELOG.md 생성 (crawler 관련 변경 이력 이전) <!-- id: 1 -->
- [ ] apps/viewer/CHANGELOG.md 생성 (viewer 관련 변경 이력 이전) <!-- id: 2 -->
- [ ] apps/ebook/CHANGELOG.md 생성 (ebook 관련 변경 이력 이전) <!-- id: 3 -->
- [ ] 루트 CHANGELOG.md 리팩토링 (통합 인덱스 및 전체 메이저 요약화) <!-- id: 4 -->
- [ ] `scripts/agents/commit-changes.sh` 실행 및 완료 확인 <!-- id: 5 -->

---

## Walkthrough

### 050-separate-changelogs.walkthrough

# Walkthrough - CHANGELOG.md 패키지별 격리 및 분리

## 🎯 작업 목적
루트 `CHANGELOG.md`에 단일 구조로 뭉쳐있던 변경 내역을 모노레포 아키텍처에 맞게 `apps/crawler`, `apps/viewer`, `apps/ebook` 하위로 나누어 격리 보관함으로써 유지보수 편의성과 형상 관리 고유성을 확보했습니다.

---

## 🛠️ 수행 결과

### 1. 개별 변경 로그 생성 완료
- **[apps/crawler/CHANGELOG.md](file:///home/ejpark/workspace/scraper/apps/crawler/CHANGELOG.md)**: 네임스페이스 격리 및 NPM 스크립트 전환 등 크롤러 관련 이력 이전.
- **[apps/viewer/CHANGELOG.md](file:///home/ejpark/workspace/scraper/apps/viewer/CHANGELOG.md)**: Vue Router 도입 및 Exporter 연동 관련 이력 이전.
- **[apps/ebook/CHANGELOG.md](file:///home/ejpark/workspace/scraper/apps/ebook/CHANGELOG.md)**: main.py 단순화 및 Pytest 도입 등 Ebook 가공 이력 이전.

### 2. 마스터 인덱스 개편
- **[CHANGELOG.md](file:///home/ejpark/workspace/scraper/CHANGELOG.md)**: 전체 거시적 릴리즈 버전에 대한 마일스톤 날짜 요약문만 남겨두고 서브 변경 로그 파일의 상대 링크 제공.

---

## 🏁 최종 상태 확인
- 루트 인덱스를 포함하여 4개의 `CHANGELOG.md` 파일이 정상 분리되어 구조화되었습니다.

---

