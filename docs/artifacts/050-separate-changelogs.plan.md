# Plan - CHANGELOG.md 패키지별 격리 및 분리

현재 프로젝트 루트에 단일 파일로 존재하는 [CHANGELOG.md](file:///home/ejpark/workspace/scraper/CHANGELOG.md)를 모노레포 구조에 맞춰 각 서비스 디렉토리 하위로 격리 및 분리합니다.

---

## 🎯 목표

1. **[apps/crawler/CHANGELOG.md](file:///home/ejpark/workspace/scraper/apps/crawler/CHANGELOG.md) 신규 생성**:
   - 크롤러(`apps/crawler`) 개발과 관련된 변경 이력(수집 데이터 분석, Namespace 리팩토링, 스크립트 마이그레이션 등)을 이동시킵니다.
2. **[apps/viewer/CHANGELOG.md](file:///home/ejpark/workspace/scraper/apps/viewer/CHANGELOG.md) 신규 생성**:
   - 뷰어(`apps/viewer`) 및 대시보드 관련 변경 이력(Exporter 통합, Vue Router 마이그레이션, UI 개선 사항 등)을 이동시킵니다.
3. **[apps/ebook/CHANGELOG.md](file:///home/ejpark/workspace/scraper/apps/ebook/CHANGELOG.md) 신규 생성**:
   - Ebook 가공 파이프라인(`apps/ebook`) 관련 변경 이력(Command 패턴 통합, 단위 테스트 추가 등)을 이동시킵니다.
4. **루트 [CHANGELOG.md](file:///home/ejpark/workspace/scraper/CHANGELOG.md) 업데이트**:
   - 루트 레벨에는 전반적인 구조 변경, 아키텍처 의사결정 등 모노레포 전체 공통 마일스톤 이력만 남기거나 정리합니다.

---

## 🛠️ 상세 작업 계획

### Step 1. 기존 루트 `CHANGELOG.md` 분석 및 이력 분배
- **Crawler 관련**:
  - `1.7.0`: AGENTS.md 규칙 분리 중 crawler 관련 내용
  - `1.3.0` 이전 & `1.2.0` Crawler Scripts 마이그레이션 내용
  - `1.1.0` sync-ebooks.ts CLI 추가 내용
  - `1.0.0` Retroactive Noise Cleansing 및 Redis Namespace 개편 내용
- **Viewer 관련**:
  - `1.7.0`: AGENTS.md 규칙 분리 중 viewer 관련 내용
  - `1.4.5`: Exporter 설정 카드 높이 재조정
  - `1.4.4`: 서적 경로 직접 입력 기능 제거
  - `1.4.3`: 로컬 이미지 깨짐 수정
  - `1.4.2`: 내보내기 정렬 역순 교정
  - `1.4.1`: 브라우저 직접 내보내기 연동
  - `1.4.0`: Exporter Web Integration 및 Vue Router 마이그레이션
- **Ebook 관련**:
  - `1.6.0`: apps/ebook 구조 단순화 및 CLI 진입점 통합
  - `1.5.0`: apps/ebook 리팩토링 및 30개 단위 테스트 도입

### Step 2. 개별 디렉토리에 `CHANGELOG.md` 생성
- `apps/crawler/CHANGELOG.md` 생성
- `apps/viewer/CHANGELOG.md` 생성
- `apps/ebook/CHANGELOG.md` 생성

### Step 3. 루트 `CHANGELOG.md` 리팩토링
- 루트 CHANGELOG.md에는 전체 마일스톤 날짜 및 간략한 메이저 변경 요약과 각 모듈별 상세 Changelog 링크를 구조적으로 제공하도록 업데이트합니다.

### Step 4. 검증 및 Git 커밋
- 파일 생성이 완료되면 `commit-changes.sh`를 구동하여 이력을 커밋합니다.

---

## 🚦 진행 승인 요청
본 계획서에 승인하시면 작업을 순차적으로 실행하겠습니다.
