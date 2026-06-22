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
