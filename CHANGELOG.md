# Monorepo Changelog (Index)

이 마스터 Changelog 파일은 모노레포 프로젝트의 통합 마일스톤 이력 및 서비스별 상세 변경 이력 연결을 담당합니다.

---

## 🧭 서비스별 상세 변경 이력 (Sub-module Changelogs)

상세 컴포넌트별 릴리즈 및 변경 로그는 각 서비스 폴더 내부의 개별 Changelog를 참고하세요.

* 🕷️ **Crawler 서비스**: [apps/crawler/CHANGELOG.md](file:///home/ejpark/workspace/scraper/apps/crawler/CHANGELOG.md)
* 🖥️ **Viewer & Dashboard**: [apps/viewer/CHANGELOG.md](file:///home/ejpark/workspace/scraper/apps/viewer/CHANGELOG.md)
* 📚 **Ebook 파이프라인**: [apps/ebook/CHANGELOG.md](file:///home/ejpark/workspace/scraper/apps/ebook/CHANGELOG.md)

---

## 🎯 통합 버전 이력 요약 (Global Milestones)

### [1.7.0] - 2026-06-23
* **격리 아키텍처 수립**: `AGENTS.md` 규칙 및 `CHANGELOG.md` 변경 로그를 각 모노레포 패키지(`apps/crawler`, `apps/viewer`, `apps/ebook`) 하위로 정밀하게 격리 및 분리 분할하여 결합도 최소화.

### [1.6.0] - 2026-06-22
* **Ebook 서비스 정밀 단순화**: Ebook 모듈의 Command 패턴 복잡성을 제거하고 단일 진입점 OOP 구현으로 정비.

### [1.5.0] - 2026-06-21
* **Ebook 테스트 도입**: Ebook 서비스 파이프라인 전면 리팩토링 및 30여 개의 단위 테스트 작성.

### [1.4.0] - 2026-06-20
* **Exporter 웹 통합**: Joplin/Obsidian Exporter 대시보드 웹 통합 배포 및 Vue Router 전환.

### [1.3.0] - 2026-06-20
* **Exporter 모듈 신설**: Exporter 기능 마이그레이션 및 동적 마크다운 로더 구현.

### [1.2.0] - 2026-06-20
* **모노레포 빌드 아키텍처 개편**: 기존 쉘/메이크파일 스크립트 결합도를 해소하고, `package.json`의 npm 스크립트로 크롤러 커맨드를 일괄 이관 및 모노레포 구조 세분화.

### [1.1.0] - 2026-06-19
* **Ebook 파이프라인 추가**: PDF 정제 및 Meilisearch/MongoDB 가공 유틸리티 통합 탑재.

### [1.0.0] - 2026-06-19
* **Redis 네임스페이스 격리**: Redis 큐 충돌 및 오동작을 수정한 Namespace 개편 릴리즈.
