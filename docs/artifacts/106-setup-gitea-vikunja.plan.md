# AGENTS.md 규칙 보완 계획서 (전체 덮어쓰기 방지 규칙 정정)

이 계획서는 이전 오동작 방지 대책으로 임의 기재된 마크다운 전체 덮어쓰기 권장 조항(규칙 22번)을 취소 정정하여, 공유 설정 문서의 안전성을 최종적으로 보장하는 조치를 다룹니다.

## Proposed Changes

### [Rules Update]

#### [MODIFY] [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md)
- 규칙 22번(마크다운 아티팩트 오염 방지) 삭제 정정:
  - 기존: 규칙 22번 (전체 덮어쓰기 지향)
  - 정정: 규칙 22번 내용 삭제 (전체 덮어쓰기는 절대 금지하며, 오직 정교한 라인 replace_file_content만 수행)

---

## Verification Plan

### Manual Verification
1. AGENTS.md 파일 갱신 후 최종 규칙 1번~21번(사전진단, 땜빵금지) 체제로 정상 확인
