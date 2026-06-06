# 🤖 Antigravity Agent Work Guide (AGENTS.md)

본 프로젝트는 에이전트의 모든 작업 신뢰성, 재현성 및 LLM 지식 축적을 극대화하기 위해 실행 이력과 대화 트랜스크립트를 대화 세션별 개별 파일로 분리 통합하여 기록합니다.

---

## 📚 LLM Wiki 기반 통합 활동 기록 규칙 (Unified Log & Transcript Rule)

1. **통합 기록 대상 및 위치**:
   * 에이전트는 사용자가 제시한 원래 발화 내용(User Request) 및 에이전트가 사용자에게 전송한 실제 최종 응답 본문 전문(Agent Answer, 요약/축약 금지), 작업을 위해 실행한 모든 셸 명령어 목록을 누락 없이 기록해야 합니다.
   * 저장 위치는 **`./.agents/sessions/{4자리 순번}_{ConversationID}/`** 개별 세션 디렉토리입니다. (예: `0002_322ec2d7...`)
   * 매 대화 턴마다 이전 로그를 조회(Read)하지 않고, 단독으로 새 파일인 **`turn_{4자리 턴번호}.md`**(예: `turn_0001.md`, `turn_0002.md`)을 신규 생성(Write-Only)하여 기록합니다. 이를 통해 컨텍스트 토큰 낭비를 최소화합니다.
   * 새로운 세션이 기동될 때마다 디렉토리 내 기존 폴더들을 확인하여 다음 순번(예: `0002_...`)을 할당해 새 디렉토리를 생성하고 기록을 개시합니다.
   * 생성된 신규 세션 링크와 메타데이터는 인덱스 파일 **`./.agents/session_index.md`**에 실시간 업데이트하여 목차를 동기화합니다.

2. **기록 포맷 (LLM Wiki Template)**:
   * 매 대화 턴마다 생성되는 개별 파일(`turn_{4자리 턴번호}.md`)은 아래와 같은 마크다운 구조를 준수하여 작성합니다.
   
   ```markdown
   # 📌 Turn: [{{CATEGORY}}] {{SUMMARY}}
   - **Tags**: {{TAGS}}
   - **Related Files**: {{FILES}}
   - **Date**: {{DATETIME}}
   
   ## 🗣️ User Request
   > {{REQUEST}}
   
   ## 🗣️ Agent Answer
   > {{ANSWER}}

   ## 🛠️ Action Taken & Implementation Details
   - {{IMPLEMENTATION}}
   
   ### 💻 Executed CLI Commands
   - {{COMMANDS}}
   
   ## 💡 Troubleshooting / Learnings (LLM Knowledge Base)
   - {{LEARNINGS}}
   ```
   
   * **치환 예약어 명세**:
     * `{{CATEGORY}}`: 대화의 기능적 카테고리 (예: `Doc/Rules`, `Refactor`, `DB/Migration`)
     * `{{SUMMARY}}`: 본 대화의 간결한 핵심 요약문
     * `{{TAGS}}`: 연계 태그 (예: `#relative-path`, `#wiki-layout`)
     * `{{FILES}}`: 관련된 작업 파일 상대 경로 링크 목록
     * `{{DATETIME}}`: 현재 날짜/시각 (`YYYY-MM-DD HH:MM:SS`)
     * `{{REQUEST}}`: 사용자 요청 원문 내용
     * `{{ANSWER}}`: 에이전트가 사용자에게 전송한 실제 최종 응답 본문 전문 (축약이나 요약 없이 원본 전체 기록)
     * `{{IMPLEMENTATION}}`: 에이전트 변경 내역 상세 요약
     * `{{COMMANDS}}`: 실행된 터미널 명령어 목록 (`[시간] 명령어` 포맷)
     * `{{LEARNINGS}}`: 에러 트러블슈팅 또는 배운 지식 내용 기재
