# 078-refactor-rules-and-dry.task.md

이 문서는 `AGENTS.md` 리팩터링 및 DRY 규칙 정의에 대한 작업 항목을 관리합니다.

## 📝 작업 목록 (Tasks)

- [x] **1단계: 규칙 파일 신규 생성**
  - [x] `.agents/rules/engineering_architecture.md` 생성 및 기존 규칙 이관
  - [x] DRY (Don't Repeat Yourself) 세부 규칙 추가 및 구조 설계
- [x] **2단계: AGENTS.md 경량화 및 참조 수정**
  - [x] `AGENTS.md` 내의 공통 엔지니어링 룰 제거
  - [x] 신규 규칙 문서에 대한 앵커 링크 및 참조 안내 추가
- [x] **3단계: commit-changes.sh 스크립트 보완**
  - [x] `.agents/rules/*` 파일들의 수정 검출 조건 추가 및 커밋 메시지 자동 생성 최적화
- [x] **4단계: 사후 문서화 및 검증**
  - [x] 작업 내역 검토서 및 완료 보고서 작성
  - [x] 자동 커밋 스크립트를 사용한 변경점 최종 제출
