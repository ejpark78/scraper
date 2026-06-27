---
name: code_review
description: AI-based semantic code review using Gemini API to audit strict typing, DRY principle, SOLID design, connection leaks, and security vulnerabilities.
---

# AI Code Reviewer Skill

이 스킬은 로컬 변경 사항(Git Diff)을 분석하고, 프로젝트 핵심 설계 규칙(`AGENTS.md`) 및 `review_checklist.md` 기준으로 의미론적 AI 코드 리뷰 피드백 보고서를 제공합니다.

## 🎯 사용 목적 및 상황
* `npm run review`와 같은 로컬 정적 검증 도구(오프라인) 외에, **설계 무결성(SOLID/DRY 원칙), 데이터베이스 연결 누수(Leak), 보안 하드코딩 여부**를 정밀 분석하고 싶을 때.
* 개발 브랜치를 병합(`git merge`)하거나 원격 저장소에 PR을 날리기 전, 최종 AI 검증(QA)을 받아보고 싶을 때.

## 🛠️ 실행 및 분석 프롬프트 가이드

에이전트는 이 스킬이 트리거되었을 때 다음 절차를 밟아 코드 리뷰를 전개해야 합니다.

### 1단계: Git Diff 추출 및 분석 자료 수집
* 현재 작업 공간의 `git diff` 및 `git diff --cached`를 분석용 데이터로 확보합니다.
* `/Users/ejpark/workspace/scraper/docs/prompts/review_checklist.md` 및 프로젝트 루트의 `AGENTS.md` 내용을 가이드로 읽어들입니까.

### 2단계: AI 분석 수행 (System Instruction)
Gemini 또는 외부 LLM API를 사용하여 수집된 diff 내용에 대해 다음 사항을 중점 감사(Audit)합니다.
1. **Strict Typing 위반 여부**: `any` 타입 명시 여부, 인터페이스/타입 선언 준수 여부.
2. **Resource Connection Leak**: MongoDB connection close, Redis quit/disconnect가 `finally` 블록에서 안전하게 호출되는지 검증.
3. **DRY 및 OOP 구조 규칙 위반**: 로직 중복, process.env 전역 무단 접근 여부.
4. **보안/크리덴셜 유출**: API 키, 비밀번호 등이 하드코딩되었거나 diff 내용에 노출되는지 진단.

### 3단계: 피드백 보고서 양식 작성
* 피드백 보고서는 개발자에게 친절한 한국어로 다음과 같이 작성하여 **`docs/artifacts/###-ai-code-review.md`** 형식의 번호가 지정된 아티팩트로 저장해야 합니다. (이때, `###`은 `docs/artifacts/INDEX.md` 파일에서 다음 사용 가능한 3자리 순차적 번호로 대체되어야 합니다.)
* 보고서 작성 후 `docs/artifacts/INDEX.md`에도 해당 문서 번호와 요약을 추가 기록해야 합니다.

```markdown
# 📝 AI 정밀 코드 리뷰 보고서

## ⚠️ 발견된 경고 및 문제점
* [이슈 등급: Critical / Warn] 내용 설명...

## 💡 코드 리팩토링 제안
* 원본 코드 및 제안 코드 블록 비교 제공.

## 🎯 종합 판정
* **[통과]** / **[보완 권장]** / **[재작성 필요]** 중 택1 및 요약 코멘트.
```
