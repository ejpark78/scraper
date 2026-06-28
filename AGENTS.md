# 🤖 Agent Project Rules (AGENTS.md)

## 🎯 Project Vision

이 프로젝트는 LinkedIn, 기술 뉴스레터, 기술 서적 등 분산된 기술 정보를 수집·구조화하여 개발자를 위한 통합 기술 지식 허브를 구축합니다. 수집 → 정제 → 검색 → LLM 분석 파이프라인을 모노레포 환경에서 운영합니다.

---

## ⚠️ 주요 제약 사항 (Critical Constraints)

### 1. 운영 및 승인 프로세스 (Process & Approvals)
* **임의 Bash 명령어 금지**: Pre-Approved 명령어를 제외한 모든 셸 명령어(읽기 전용 진단, git, docker, ls, env 등 포함)는 사용자의 명시적 승인이 필요합니다. 정확한 명령어를 채팅에 먼저 제시하고 승인을 받으세요. 여러 진단/상태 확인 및 `docker compose exec / run` 등을 통한 컨테이너 내부 셸 호출은 `&&`, `;` 또는 `cat << 'EOF' | bash`로 연결하여 단일 실행으로 압축하세요.
* **Gitea 이슈 기반 단일 계획 수립 및 자율 일괄 실행**:
  * 파일 쓰기나 환경 변경 전에 Gitea API 또는 헬퍼 스크립트를 사용하여 Gitea에 이슈를 자동 생성하고 계획안을 본문에 상세 기술하여 해당 이슈 링크를 제시하고 최종 승인을 받으세요. (로컬 `plan.md` 및 `action_items.md` 작성 절차는 폐지하고 Gitea 이슈로 단일화합니다.)
  * **Gitea API 및 헬퍼 스크립트 활용**: 이슈 발행, 댓글 등록, 이슈 마감 등의 상태 제어 시 프로젝트에 마련된 TypeScript 헬퍼 스크립트(`npx ts-node .agents/scripts/gitea.ts`)를 최우선적으로 활성화하여 활용합니다. 기존 Gitea MCP 및 대화형 CLI 명령어(tea, curl 등)를 사용해 직접 수동으로 Gitea API를 제어하는 셸 호출은 지양하며, 본 헬퍼 스크립트(`gitea.ts`)를 통해 일관되게 제어합니다. 만약 API 연결에 장애가 있다면 무음 복구를 진행하지 말고 즉시 사용자에게 보고하여 검증 절차를 거칩니다.
  * **승인 전 편집 금지**: 계획 제안 단계 또는 사용자 피드백을 받아 계획을 갱신하는 단계에서는, 사용자의 명시적인 승인(Proceed 버튼 클릭, Gitea 승인 댓글, 또는 채팅 승인)이 떨어지기 전에는 실제 소스 코드나 설정 쓰기/수정 도구(replace_file_content 등)를 호출하지 마세요.
  * **자율 일괄 실행**: 최종 승인된 이후에는 계획에 명시된 후속 작업(체크리스트 업데이트, 소스 코드 수정, Gitea 댓글 결과 보고 및 이슈 종결)을 추가 승인 요청 없이 단일 턴에 자율적으로 일괄 처리합니다.
* **동시 백그라운드 작업 금지**: 경쟁 상태 방지를 위해 사용자의 명시적 승인 없이 여러 백그라운드 명령어를 병렬 실행하지 마세요.
* **투명한 이슈 처리 및 보고**: 오류는 즉시 보고하며 무음 복구는 금지됩니다. 자가 트러블슈팅은 최대 2회로 제한합니다.
* **AI 처리 및 응답 한국어**: 모든 AI 처리 로그, 상태 메시지, 채팅 응답은 한국어로 작성합니다.

### 2. 코드 검증 및 런타임 제약 (Code & Runtime Constraints)
* **Docker 중심 테스트 및 실행**: 로컬 스크립트는 `docker compose` 내부망에서 실행 및 진단해야 합니다. 호스트에 DB 포트를 직접 노출하지 말고 Traefik 프록시 도메인을 경유하여 통신합니다. 정적 스타일 및 타입 검증(`npm run lint`, `npm run type-check`), 정적 코드 리뷰(`npm run review`) 또한 컨테이너 내부로 위임(Proxying)하여 격리 실행되도록 구성해야 합니다.
* **Python 및 uv 가상환경 실행**: Python 스크립트 실행 및 패키지 관리 시, 호스트의 전역 Python 대신 반드시 `uv run` 또는 `docker compose` 가상환경 컨텍스트 내에서 실행해야 합니다.
* **데이터 변경 및 인프라 제어 사용자 위임**:
  * 데이터 손상 방지를 위해 주요 영구 데이터 변경, DB 시딩, 인덱스 리셋/재인덱싱은 에이전트가 직접 실행하지 않고 사용자에게 수동 실행을 요청합니다.
  * 컨테이너 재빌드, 서비스 재시작, 이미지 정리 등 복잡한 런타임 배포 시 명령어를 직접 실행하지 말고 사용자에게 수동 실행을 요청(협업 페어 프로그래밍)하십시오.
* **최소 파일 범위 및 커버리지**: 루트 레벨 grep이나 재귀 list_dir을 피하고, 구조 파악 시 `git ls-files`를 1회 실행한 후 대상 파일을 직접 `Read`하십시오. 코드 심볼 검색 시 `Grep`으로 일치하는 라인만 찾아 탐색을 종결합니다.
* **범위 외 및 추측 수정 금지**: 명시적 요청 외의 파일 수정과 원인을 모르는 상태에서의 추측성 코드 수정을 엄격히 금지합니다.
* **사전 환경 진단 철저**: 환경 변조 전 `docker inspect` 등으로 컨테이너 베이스 및 경로 구조를 분석한 후 작업을 진행합니다. ad-hoc식(임시방편) 해결이나 헬스체크 임의 삭제를 금지합니다.

### 3. Git 및 협업 방식 (Git & Collaboration)
* **Git Flow 브랜치 전략 준수**: `main` 직접 수정 절대 금지, 브랜치 전환 전 커밋 완료 필수, 충돌 시 강제 푸시 금지 등 [Git Flow Guide](.agents/rules/git_flow.md)를 따릅니다. 작업 시작 시 브랜치를 확인하고 `main` 또는 `develop`일 경우 브랜치 전환을 제안합니다. 작업 완료 후에는 `npm run commit`을 활용해 커밋 및 머지를 처리합니다.
* **자동 Git 커밋**: 유효한 편집 직후 또는 특정 단위 작업 완료 시 `npm run commit`을 실행하여 로컬 저장소에 저장합니다.
* **상대경로 링크 사용**: 문서 내에서는 상대경로를 사용하고(예: `[Worker](src/Worker.ts)`), `file://` scheme 사용을 금지합니다.
* **사용자 중요 정보 고지 의무**: 인프라 변경, 계정 정보(ID, 임시 비번), 웹 접속 주소 등 핵심 설정 변경이 발생한 경우, 아티팩트뿐만 아니라 채팅창에도 요약 고지해야 합니다.

---

## ⚠️ 보안 규칙 (Security Rules)
- **ENV 접근 금지**: `.env` 또는 `.env.*` 파일에 직접 접근하거나 쓰기를 수행하지 말고, `.env.example`을 참조하세요.
- **자격 증명 노출 금지**: API 키 및 패스워드를 명령어 출력에 노출하지 마세요.
- **MCP 설정 제약**: 프로젝트 내 `.mcp.json` 파일에 쓰기를 수행하거나 API 토큰 등의 민감 정보를 직접 하드코딩해 주입하지 않습니다. Gitea/PMS 연동을 위한 자격 증명 갱신 시에는 발급된 토큰 값을 채팅창에 고지하여 사용자가 수동으로 `.env` 파일에 기입하도록 안내합니다.

---

## ⚙️ 엔지니어링 및 아키텍처 규칙 (Engineering & Architecture Rules)
* **공통 규칙 및 DRY 원칙 준수**: 모든 개발 시 strict typing, OOP 설계, 에러 처리를 상시 준수하고, 자세한 가이드는 [Engineering & Architecture Guide](.agents/rules/engineering_architecture.md)를 참고합니다.

---

## 🛠️ 기술 스택별 작업 규칙 (Tech Stack Rules)
* **코딩 규칙 준수**: strict typing(`any` 금지), class OOP 설계, `uv` 의존성 관리 등을 따르고, 상세 가이드는 [Tech Stack Guide](.agents/rules/tech_stack.md)를 참고합니다.

---

## 🧭 Agent Skill Directory Map

작업 시 컨텍스트에 따라 해당 Skill 파일을 활성화/참조하세요:

| 컨텍스트 | Skill 파일 | 설명 |
|:---|:---|:---|
| 사이트 크롤러/파이프라인 | [develop_sites_skills.md](.agents/skills/develop_sites_skills.md) | Bronze→Silver 파이프라인, Base 클래스 |
| DB/인덱스 | [database_skills.md](.agents/skills/database_skills.md) | MongoDB/Redis 스키마, 인덱스 |
| HTML/스크래핑 디버깅 | [html_debugging_skills.md](.agents/skills/html_debugging_skills.md) | HtmlDebugger 유틸, HTML 덤프 |
| Firecrawl 웹 검색 | `~/.claude/skills/firecrawl-*/` | Firecrawl CLI 스킬들 |

---

## 💡 Token Efficiency Rules
1. **아티팩트 사전 스캔 금지**: `docs/artifacts/` 문서는 자동으로 읽지 않음. 필요 시 INDEX.md에서 번호 확인 후 직접 Read.
2. **AGENTS.md 유지보수**: 불필요한 예제/중복 발견 시 능동적으로 정리.

---

## 🔓 사전 승인 명령어 (Pre-Approved Commands)
다음 명령어/스크립트는 사전 승인되었으며, 승인 절차에서 제외됩니다:
- `git ls-files` (프로젝트 코드베이스 매핑용)
- `scripts/agents/commit-changes.sh` (편집 후 자동 저장용)
