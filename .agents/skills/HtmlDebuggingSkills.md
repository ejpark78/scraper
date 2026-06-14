# 💡 HTML 크롤러 및 변환 디버깅 기술 (HtmlDebuggingSkills.md)

이 문서는 크롤러 수집 로그 분석 및 HTML 파싱/변환기(Converter)의 동작을 디버깅하기 위한 실무 기술 및 CLI 가이드를 정의합니다.

---

## 1. 🔍 변환 오류 및 컨테이너 로그 분석

운영 중 발생한 에러 로그를 빠르게 취합하여 에러 스택을 분석하는 방법입니다.

### 1.1 `grep-errors` 실행
컨테이너 전체 로그 중 에러 및 변환 실패 사례만 파싱하여 분석합니다:
```bash
docker compose -p linkedin logs --no-color scraper converter | \
  docker compose -p linkedin run --rm -T \
  -v ./src/scripts:/app/src/scripts \
  worker npx ts-node src/scripts/grep-errors.ts
```
- 이 명령을 통해 어떤 사이트의 어떤 문서 ID에서 변환 실패(`Transformation failed`) 혹은 수집 실패가 빈번한지 통계를 산출할 수 있습니다.

---

## 2. 🛠️ `debug_html.ts`를 활용한 파싱 검증

수집된 HTML에서 본문이 잘 추출되지 않거나 Turndown 변환 결과가 깨질 때, `HtmlDebugger`를 사용해 계층적 분석 보고서를 얻을 수 있습니다.

### 2.1 로컬 HTML 테스트 파일 분석
테스트 픽스처(Fixture)나 로컬 다운로드한 HTML 파일의 유효 태그, 본문 후보군을 점검할 때 사용합니다:
```bash
docker compose -p linkedin run --rm \
  -v $(pwd):/app -v /app/node_modules \
  worker npx ts-node src/scripts/debug_html.ts --file tests/sites/yozm/fixtures/article.html
```

### 2.2 MongoDB 적재 문서 직접 디버깅
`bronze` 컬렉션에 이미 저장되어 있는 특정 문서를 지정해 디버깅 분석을 실행합니다:
```bash
docker compose -p linkedin run --rm \
  -v $(pwd):/app -v /app/node_modules \
  worker npx ts-node src/scripts/debug_html.ts --site yozm --id 3800
```
- 스크립트가 실행되면 해당 HTML 문서의 크기, 구조 분석 결과, 우선순위가 높은 DOM 요소(JSON-LD, Meta Tags 등) 정보를 출력하여 파서 규칙을 튜닝하기 유용합니다.
