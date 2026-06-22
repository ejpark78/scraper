# 047-ebook-changelog-separation.plan.md

이 문서는 루트 `CHANGELOG.md`로부터 `apps/ebook` 관련 히스토리를 독립된 하위 `CHANGELOG.md`로 분리하고, 이를 `AGENTS.md` 명세에 반영하는 계획을 다룹니다.

---

## 🎯 목표 및 배경
- **히스토리 격리**: 모노레포 구조에서 개별 서비스인 `apps/ebook`이 가진 자체 생명주기와 변경 사항을 모듈 단위로 관리하기 위해 전용 CHANGELOG를 구축합니다.
- **명세서 동기화**: `apps/ebook/AGENTS.md`에 변경 이력 링크를 추가하여 해당 모듈의 히스토리 흐름을 쉽게 파악하도록 합니다.

---

## 🛠️ 작업 목록 (Work Items)

### 1. `apps/ebook/CHANGELOG.md` 신규 생성
- 루트 `CHANGELOG.md`에서 Ebook 파이프라인과 관련한 추가, 리팩토링, 제거 이력들을 추출하여 재구성합니다.
  - **v1.6.0 (2026-06-22)**: OOP 리팩토링, 데드코드(`pdf_parser`, `constants`) 제거, 단위 테스트 Mock 버그 수정.
  - **v1.5.0 (2026-06-21)**: 중복 코드 제거, `constants` 상수 분리, 단위 테스트 도입(Phase 1~4 리팩토링).
  - **v1.1.0 (2026-06-19)**: 파이썬 3.13 및 `uv` 환경의 Ebook Pipeline 최초 도입, docker compose 프로필 정의.

### 2. `apps/ebook/AGENTS.md` 업데이트
- 문서 하단에 `## 변경 이력` 섹션을 추가하고, 새로 생성된 `./CHANGELOG.md` 경로 링크를 명시합니다.

---

## 📋 세부 수정 계획 표

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/ebook/CHANGELOG.md` | **Create** | Ebook 관련 릴리즈 변경사항 독립 문서화 |
| `apps/ebook/AGENTS.md` | **Modify** | 변경 이력 설명 추가 및 상대 경로 링크 반영 |

---

## 🧪 검증 시나리오
1. 작성한 마크다운 파일들의 서식 및 경로가 올바른지 확인합니다.
2. `make test`를 수행하여 리팩토링으로 인한 기존 테스트 영향이 없는지 최종 1회 검증합니다.
