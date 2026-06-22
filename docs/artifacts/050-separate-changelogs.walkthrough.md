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
