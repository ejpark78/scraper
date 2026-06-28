# AGENTS.md 규칙 보완 계획서 (세션 개선 및 행동 지침 명문화)

이 계획서는 빌드 환경 지레짐작 오동작 및 땜빵식 정비 꼼수 재발을 방지하기 위해 분석 및 반성 결과를 `AGENTS.md`에 공식 규정으로 새겨 정립하는 조치를 다룹니다.

## Proposed Changes

### [Rules Update]

#### [MODIFY] [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md)
- 주요 제약 사항(Critical Constraints) 하단 영역에 규칙 20번, 21번, 22번 추가:
  - **20. 사전 환경 진단 철저**:
    - 도커 빌드나 환경 변조 전, 대상 이미지의 베이스(OS, scratch 여부), 가상 경로 구조 등을 `docker inspect`나 사전 읽기 도구로 분석하기 전에는 환경 설정을 지레짐작으로 고치지 마십시오.
  - **21. 땜빵식(Ad-hoc) 해결 금지**:
    - 헬스체크를 임의 삭제하는 등의 편법으로 에러를 덮으려 하지 마십시오. 멀티스테이지 등 표준 컨테이너 설계에 부합하는 정석 해법을 1순위로 고민해야 합니다.
  - **22. 마크다운 아티팩트 오염 방지**:
    - `task.md` 등 마크다운 문서 갱신 시, 문구 교체 도구(`replace_file_content`)의 줄 오차로 인한 컨텍스트 꼬임(루프)을 예방하기 위해 `write_to_file`의 `Overwrite=true` 속성을 이용한 전체 덮어쓰기 사용을 적극 지향하십시오.

---

## Verification Plan

### Manual Verification
1. AGENTS.md 파일 갱신 후 다음 턴부터 해당 강화된 행동 수칙이 인지되는지 확인
