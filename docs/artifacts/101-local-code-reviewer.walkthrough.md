# 101-local-code-reviewer.walkthrough.md

로컬 변경 사항에 대한 AI 코드 리뷰 유틸리티 추가 작업을 완료한 결과보고서입니다.

---

## 🎯 1. 구현 기능 요약 (Features Summary)
* **로컬 AI 코드 리뷰 실행**: `npm run review`를 실행하면, 현재 스테이징되었거나 수정 중인 코드의 `git diff`를 자동으로 읽어서 AI 모델(Gemini 1.5 Flash)로 보냅니다.
* **설계 규칙 및 체크리스트 준수 여부 검토**: 분석 시 `AGENTS.md`의 설계 원칙과 `docs/prompts/review_checklist.md` 체크리스트를 기반으로 작성하여 경고/문제점, 권장 사항, 종합 판정 결과를 터미널에 요약해 줍니다.
* **자동 저장**: 분석된 리뷰 보고서는 `docs/artifacts/review-report.md` 파일로도 저장되어 개발자가 상세히 읽을 수 있습니다.
* **커밋 가이드 결합**: `scripts/agents/commit-changes.sh` 실행 시 커밋을 수행하기 직전 변경 사항을 자동으로 모니터링하여 리뷰 피드백을 출력합니다. (`GEMINI_API_KEY`가 주입되지 않은 개발 장비에서는 에러 없이 스킵하도록 예외 처리)

---

## 🔍 2. 자가 검증 결과
* 스크립트 실행 권한 확인 완료 (`chmod +x scripts/agents/review-changes.sh`).
* 로컬 터미널에서 `npm run review`를 구동하여 동작 상태 진단 및 예외 우회 플로우 검증 성공.
* `commit-changes.sh` 커밋 가이드 결합을 통해 자동 호출 프로세스 정상 흐름 확인.
