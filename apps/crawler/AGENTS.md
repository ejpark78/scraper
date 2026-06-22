# 🤖 Agent Project Rules - Crawler Scope (apps/crawler/AGENTS.md)

이 규칙은 `apps/crawler` 내의 코드를 수정하거나 해당 컨텍스트에서 작업을 수행할 때 적용되는 전용 제약 사항입니다.

---

## ⚠️ crawler 전용 제약 사항 (Critical Constraints)

1. **Docker 중심 테스트 및 실행**:
   - **디버깅/테스트**: 항상 볼륨 마운트를 사용하여 소스 파일을 실시간 동기화합니다.
     - 예시: `docker compose -p scraper run --rm --user $(id -u):$(id -g) -v $(pwd):/app -v /app/node_modules worker npx ts-node src/...`
   - **Playwright 브라우저 불일치**: `browserType.launch: Executable doesn't exist` 오류 발생 시 다음 중 하나를 실행합니다:
     - 종속성 버전 정렬을 위해 worker 이미지만 재빌드: `docker compose build worker`
     - 또는 컨테이너에서 브라우저 설치: `docker compose run --rm worker npx playwright install`

2. **재귀 수집 금지 및 1회성 수집 고정**:
   - 실시간 스크랩 시 페이지 내 링크들을 파싱하여 수집 큐에 재유입시키는 재귀 수집(`RECURSIVE_SCRAPE`) 기능은 제거되었습니다.
   - 모든 수집 작업은 1회성 수집으로 고정되며, 큐에는 1회성 명령만 추가되어 무한 큐 증식을 방지합니다. (단, `BaseRefreshUrls.ts`에 내장된 기존 완료 HTML 정밀 스캔 복구 기능은 그대로 보존되어 정상 작동합니다.)

---

## 🧭 Agent Skill Directory Map (Crawler Context)

작업 시 crawler 컨텍스트에 따라 해당 Skill 파일을 활성화/참조하세요:

| 컨텍스트 | Skill 파일 | 설명 |
|:---|:---|:---|
| 사이트 크롤러/파이프라인 | [develop_sites_skills.md](../../.agents/skills/develop_sites_skills.md) | Bronze→Silver 파이프라인, Base 클래스 |
| HTML/스크래핑 디버깅 | [html_debugging_skills.md](../../.agents/skills/html_debugging_skills.md) | HtmlDebugger 유틸, HTML 덤프 |
