# 🤖 Antigravity Agent Work Guide (AGENTS.md)

본 프로젝트는 에이전트의 모든 작업 신뢰성, 재현성 및 LLM 지식 축적을 극대화하기 위해 실행 이력과 대화 트랜스크립트를 대화 세션별 개별 파일로 분리 통합하여 기록합니다.

---

## 📋 작업 계획 수립 및 완료 리뷰 규칙 (Execution & Review Planning Rule)

1. **새로운 사용자 요청/발화 시작 시 기존 계획 아카이브**:
   * 새로운 사용자 요청 또는 발화가 유입되면, 이전 작업의 흔적을 보존하기 위해 루트 디렉토리에 위치한 다음 파일들을 백업 폴더로 이동합니다:
     * 대상 파일: `./.agents/plan.md`, `./.agents/tasks.md`, `./.agents/reviews.md`
     * 이동 경로: `./.agents/tasks/{4자리 숫자}-YYYY-MM-DDTHHMMSS/` (이전 작업 폴더 순번에 이은 다음 4자리 순번 및 현재 타임스탬프 디렉토리를 생성하여 이동)
2. **계획 및 태스크 파일 작성**:
   * 에이전트는 작업을 실제로 실행(코드 변경, 명령어 실행 등)하기 전에, 반드시 다음 두 파일을 새로 작성해야 합니다.
     * **`./.agents/plan.md`**: 작업의 목적, 분석 결과, 단계별 작업 시나리오 및 검증 계획을 포함하는 전체 작업 계획서.
     * **`./.agents/tasks.md`**: 구현해야 할 세부 작업 목록(To-Do List)과 진행 상황을 표시하는 문서.
3. **사용자 검토 및 승인**:
   * 위 파일들을 작성한 후, 사용자에게 계획서와 태스크 목록에 대한 검토를 먼저 요청해야 합니다. 사용자가 검토 후 동의(Proceed)하거나 승인한 후에만 실제 물리적 작업(코드 수정, 삭제, 터미널 실행 등)에 착수할 수 있습니다.
4. **실행 완료 및 리뷰 요청**:
   * 계획된 작업 및 구현 검증이 완료되면, 에이전트는 최종적으로 **`./.agents/reviews.md`** 파일을 생성하여 작업 완료 보고 및 자체 검증 결과를 기재하고 사용자에게 리뷰를 요청해야 합니다.

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
     * `{{FILES}}`: 관련된 작업 파일 **상대 경로** 링크 목록
     * `{{DATETIME}}`: 현재 날짜/시각 (`YYYY-MM-DD HH:MM:SS`)
     * `{{REQUEST}}`: 사용자 요청 원문 내용
     * `{{ANSWER}}`: 에이전트가 사용자에게 전송한 실제 최종 응답 본문 전문 (축약이나 요약 없이 원본 전체 기록)
     * `{{IMPLEMENTATION}}`: 에이전트 변경 내역 상세 요약
     * `{{COMMANDS}}`: 실행된 터미널 명령어 목록 (`[시간] 명령어` 포맷)
     * `{{LEARNINGS}}`: 에러 트러블슈팅 또는 배운 지식 내용 기재
