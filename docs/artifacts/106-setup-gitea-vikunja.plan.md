# AGENTS.md 규칙 보완 계획서 (사용자 주요 정보 채팅 고지 의무화)

이 계획서는 인프라 구축이나 개발 중 발생하는 중요 정보(예: 계정 ID/비밀번호, 환경 구성 변경 등)를 문서에만 숨겨두지 않고, 대화창(채팅)을 통해 사용자에게 명확히 선제적으로 알리도록 `AGENTS.md` 규칙을 강화하는 조치를 다룹니다.

## Proposed Changes

### [Rules Update]

#### [MODIFY] [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md)
- 주요 제약 사항(Critical Constraints) 부분에 신규 규칙 19번 추가:
  - **19. 사용자 중요 정보 채팅 고지 의무**:
    - 개발 도중 생성된 계정 정보(ID, 임시 비밀번호), 접속 URL, 환경 설정 정보 등 사용자가 직접 인지하고 테스트해야 하는 중요한 변경 사항은 아티팩트 문서에만 기록하지 마십시오.
    - 반드시 결과 보고 및 대화 완료 턴의 채팅 창에도 이를 명확하게 요약하여 한 번 더 선제적으로 명시해야 합니다.

---

## Verification Plan

### Manual Verification
1. AGENTS.md 파일 갱신 후 에이전트 행동 지침 로드 확인
