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
