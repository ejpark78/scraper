# 📝 109-make-agents-pms.task.md

이 문서는 `make agents-pms` 구현 및 아티팩트 소급 적용 작업을 완료하기 위한 세부 태스크 리스트입니다.

---

## 🎯 작업 목록

### 1. 환경 및 설정 구성
- [ ] Gitea & Vikunja 연동 설정 분석 및 환경 변수 설계 (API Tokens)
- [ ] `.env.example` 파일에 환경 변수 정의 추가

### 2. 동기화 스크립트 작성 (`scripts/agents/sync-pms.ts`)
- [ ] `docs/artifacts/` 폴더 내 Markdown 파일 목록을 파싱 및 그룹화
- [ ] Gitea API 연동 모듈 (Repository / Issue 생성 및 본문 동기화) 구현
- [ ] Vikunja API 연동 모듈 (Project / Buckets / Tasks 생성 및 이동) 구현
- [ ] 소급 적용을 위한 업서트(Upsert) 및 멱등성 검증 로직 구현

### 3. Makefile 통합
- [ ] `Makefile`에 `agents-pms` 타겟 추가 (컨테이너 내부 실행 브릿지)

### 4. 결과 보고서 작성
- [ ] `109-make-agents-pms.walkthrough.md` 작성 및 최종 성과 요약
