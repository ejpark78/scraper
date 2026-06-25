# 🤖 Agent Project Rules (AGENTS.md)

## 🎯 Project Vision

이 프로젝트는 LinkedIn, 기술 뉴스레터, 기술 서적 등 분산된 기술 정보를 수집·구조화하여 개발자를 위한 통합 기술 지식 허브를 구축합니다. 수집 → 정제 → 검색 → LLM 분석 파이프라인을 모노레포 환경에서 운영합니다.

---

## ⚠️ 주요 제약 사항 (Critical Constraints)

1. **임의 Bash 명령어 금지**: Pre-Approved 명령어를 제외한 모든 셸 명령어(읽기 전용 진단, git, docker, ls, env 등 포함)는 사용자의 명시적 승인이 필요합니다. 정확한 명령어를 채팅에 먼저 제시하고 승인을 받으세요. 여러 진단/상태 확인은 `&&`, `;` 또는 `cat << 'EOF' | bash`로 연결하여 단일 실행으로 압축하세요.
2. **계획 수립 철저 및 자율 일괄 실행**: 파일 쓰기나 환경 변경 전에 `docs/artifacts/` 디렉토리에 특정 파일명으로 계획서 파일(.plan.md)을 작성하여 제시하고 최종 승인을 받으세요.
   * **CRITICAL**: 계획서 파일 제안 단계에서는 실제 소스 코드나 설정 쓰기/수정 도구를 호출하지 말고 사용자의 명시적인 승인을 먼저 기다리세요.
   * **자율 실행**: 사용자로부터 계획서(.plan.md)가 최종 승인된 이후에는, 계획에 명시된 후속 작업(할 일 목록 작성, 실제 소스 코드 및 설정 파일 수정, 검토서 및 결과보고서 작성)을 추가적인 개별 승인 요청 없이 에이전트가 단일 턴에 자율적으로 일괄 작성하고 실행할 수 있습니다. (단, 추가적인 쉘 명령어 실행이나 외부 인프라 변경은 기존처럼 사용자의 명시적 승인이 요구됩니다.)
3. **최소 파일 범위 및 커버리지**: 루트 레벨 grep이나 재귀 list_dir을 사용하지 마세요.
   * 중첩 폴더를 놓치지 않고 프로젝트 구조를 파악하려면 `git ls-files`를 한 번 실행하세요.
   * 정확한 대상 파일 경로를 찾은 후 `Read`로 직접 읽으세요.
   * 여러 파일에서 코드 심볼을 검색할 때는 `Grep`을 사용하여 일치하는 라인 번호만 찾고, 파일을 하나씩 읽지 마세요 (API/토큰 소비 최소화).
4. **투명한 이슈 처리**: 오류는 즉시 보고합니다. 무음 복구 금지. 사용자 리뷰 없이 자가 트러블슈팅은 최대 2회.
5. **상대경로 링크**: 문서에서는 상대경로를 사용하세요 (예: `[Worker](src/Worker.ts)`). `file://` 사용 금지.
6. **자동 Git 커밋**: 유효한 편집 직후 `scripts/agents/commit-changes.sh`를 실행합니다.
7. **Docker 중심 테스트 및 실행**: 로컬 스크립트는 `docker compose` 내부망에서 실행 및 진단해야 합니다. 호스트에 DB 포트를 직접 노출하지 말고 Traefik 프록시 도메인을 경유하여 통신하며, Netshoot 진단이나 MCP 도구를 사용합니다. 자세한 구성과 볼륨 마운트 해결 규칙은 [Docker Environment Guide](file:///Users/ejpark/workspace/scraper/.agents/rules/docker_environment.md)를 상시 참고하세요.
8. **트랜스크립트 내보내기 (수동 실행)**: 세션 시작 시 `make agents-dump`를 자동 실행하지 마세요. 사용자가 요청하거나 세션 결과를 요약할 때만 명령어 라인을 제공하세요.
9. **동시 백그라운드 작업 금지**: 경쟁 상태 및 DB/시스템 상태 손상을 방지하기 위해, 각 명령어에 대한 사용자의 명시적 승인 없이 여러 백그라운드 명령어/태스크를 병렬 실행하지 마세요. 활성 백그라운드 작업이 완전히 종료되고 종료 상태를 확인한 후에만 다음 명령어 승인을 요청하세요.
10. **데이터 변경은 사용자에게 위임**: 데이터 손상이나 충돌을 방지하기 위해, 에이전트는 주요 영구 데이터 변경, DB 시딩, 인덱스 리셋/재인덱싱(예: `meili-manager.ts --reset`)을 실행하거나 승인 요청하지 마세요. 대신 필요한 실행 단계와 명령어를 채팅에 명확히 설명하고 사용자가 수동으로 실행하도록 요청하세요.
11. **환경 제어 공동 위임 (페어 프로그래밍)**: 컨테이너 재빌드, 서비스 재시작, 이미지 정리, 복잡한 런타임 배포 등의 작업 실행 시, 에이전트는 협업 파트너처럼 행동하세요. 명령어를 직접 실행하지 말고, 목적과 명령어를 설명하며 사용자가 수동으로 실행하도록 요청하십시오.
12. **AI 처리 및 응답 한국어**: 모든 AI 처리 로그, 상태 메시지, 채팅 응답은 한국어로 작성합니다.
13. **범위 외 수정 금지**: 사용자가 명시적으로 요청한 범위 밖의 파일은 수정하지 마세요.
14. **추측 수정 금지**: 추측에 기반한 코드 수정은 엄격히 금지됩니다. 문제의 근본 원인을 모르면 사용자에게 문의하세요.
15. **개별 패키지 전용 규칙의 격리**: crawler 및 viewer 전용 세부 실행 방식/제약 조건은 각각 `apps/crawler/AGENTS.md` 및 `apps/viewer/AGENTS.md` 파일에 정의합니다. 에이전트는 해당 하위 디렉토리 작업 시 개별 규칙을 확인하고 준수해야 합니다.
16. **Git Flow 브랜치 전략 및 에이전트 행동 지침**: `main` 직접 수정 절대 금지, 브랜치 전환 전 `commit-changes.sh` 실행 완료 필수, 충돌 시 강제 푸시 금지 등 핵심 동작 룰을 준수합니다. 특히 작업 세션 시작 시 반드시 현재 git 브랜치를 식별하고, `main` 브랜치일 경우 코드 수정을 시작하기 전에 브랜치 전환(`git checkout develop` 또는 `git checkout -b feature/*`)을 제안하고 사용자에게 경고해야 합니다. 구체적인 브랜치 명명법과 커밋/머지 절차는 [Git Flow Guide](file:///Users/ejpark/workspace/scraper/.agents/rules/git_flow.md)를 로드하여 준수해야 합니다. 또한 Git 히스토리를 조사할 때는 단발성 명령어를 반복 실행하여 덤프 루프를 돌지 말고 단일 턴에 통합 조회해야 합니다.


## ⚠️ 보안 규칙 (Security Rules)
- **ENV 접근 금지**: `.env` 또는 `.env.*` 파일에 접근하지 마세요. `.env.example`을 참조하세요.
- **자격 증명 노출 금지**: API 키/자격 증명을 명령어 출력에 노출하지 마세요.

## ⚙️ 엔지니어링 및 아키텍처 규칙 (Engineering & Architecture Rules)

1. **Strict OOP Patterns**: 클래스, 인터페이스, SOLID 원칙을 사용합니다. 핵심 로직에 느슨한 유틸리티 함수 사용을 지양합니다.
2. **Strict Typing**: 'any' 타입 사용을 금지합니다. public 메서드에 명시적 반환 타입과 인터페이스를 선언합니다.
3. **Robust Error Handling**: 빈 catch 블록을 사용하지 마세요. 항상 에러 컨텍스트를 로깅하고 finally 블록에서 DB/Redis 연결을 종료합니다.
4. **Centralized Config**: 'process.env'는 전용 설정 파일에서만 접근합니다. 생성자를 통해 설정을 주입합니다.
5. **Agent-Friendly Docstrings**: 모든 소스, 스크립트, 자동화 파일에 설계 컨텍스트, 제약 조건, 의존성을 설명하는 헤더 docstring/주석을 추가하여 리팩터링 루프를 방지합니다. 동작 변경 시 업데이트합니다.
6. **No Superficial Patches**: 오류 발생 시 표면적 패치(예: 커스텀 regex 제외나 하드코딩 파라미터로 증상 숨기기)를 절대 구현하지 마세요. 항상 데이터 흐름을 추적하고, DB/상태 조정을 조사하여 진정한 근본 원인을 찾아 견고한 구조적/아키텍처 솔루션을 구현하세요. **또한 버그가 수정(Bugfix)되었을 때에는 단순 변경사항과 엄격히 구분하여 CHANGELOG와 코드 리뷰 문서에 'Bugfix'임을 명확히 표기하고 기록해야 합니다.**

## 🛠️ 기술 스택별 작업 규칙 (Tech Stack Rules)
* **코딩 규칙 준수**: 코딩 작업 시 strict typing(`any` 금지), class OOP 설계, `uv` 의존성 도구 관리 등의 언어별 코딩 스타일을 명확히 알아야 합니다. 상세 코딩 가이드는 [Tech Stack Guide](file:///Users/ejpark/workspace/scraper/.agents/rules/tech_stack.md)를 로드하여 규칙을 따르세요.

## 📝 Documentation Lifecycle Rules
* **문서화 의무 준수**: 모든 기능 변경은 Spec -> Plan -> Review -> Walkthrough 수명 주기를 밟으며 3자리 접두사를 가진 아티팩트로 보존해야 합니다. 상세 작성 템플릿과 Squash 정책은 [Documentation Lifecycle Guide](file:///Users/ejpark/workspace/scraper/.agents/rules/documentation_lifecycle.md)를 상시 참고하세요.

## 🧭 Agent Skill Directory Map

작업 시 컨텍스트에 따라 해당 Skill 파일을 활성화/참조하세요:

| 컨텍스트 | Skill 파일 | 설명 |
|:---|:---|:---|
| 사이트 크롤러/파이프라인 | [develop_sites_skills.md](.agents/skills/develop_sites_skills.md) | Bronze→Silver 파이프라인, Base 클래스 |
| DB/인덱스 | [database_skills.md](.agents/skills/database_skills.md) | MongoDB/Redis 스키마, 인덱스 |
| HTML/스크래핑 디버깅 | [html_debugging_skills.md](.agents/skills/html_debugging_skills.md) | HtmlDebugger 유틸, HTML 덤프 |
| Firecrawl 웹 검색 | `~/.claude/skills/firecrawl-*/` | Firecrawl CLI 스킬들 |

## 💡 Token Efficiency Rules

1. **아티팩트 사전 스캔 금지**: `docs/artifacts/` 문서는 자동으로 읽지 않음. 필요 시 INDEX.md에서 번호 확인 후 직접 Read
2. **AGENTS.md 유지보수**: AGENTS.md는 불필요한 예제/중복 발견 시 정리
3. **Compact 정기 정리**: 10세션마다 또는 아티팩트 50개 초과 시 `make agents-squash` 권장

## 🔓 사전 승인 명령어 (Pre-Approved Commands)

다음 명령어/스크립트는 사전 승인되었으며, 규칙 1과 2의 승인 절차에서 제외됩니다:
- `git ls-files` (토큰/API 사용 최소화를 위한 읽기 전용 프로젝트 코드베이스 매핑)
- `scripts/agents/commit-changes.sh` (편집 후 자동 실행되어 진행 상황 저장)
