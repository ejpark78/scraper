# Walkthrough: apps/exporter 통합 및 Joplin/Obsidian 내보내기 이식 결과보고서

본 문서는 `apps/exporter` 이식 작업을 수행한 뒤 성공한 빌드 및 실행 테스트 검증 명세입니다.

---

## 1. 빌드 및 테스트 환경
- **Docker Image**: `node:20-alpine` 기반 빌드
- **컨테이너명**: `scraper-exporter`
- **네트워크**: `scraper_default` (기존 DB 인프라 공유용 외부 네트워크 연동)
- **볼륨 마운트**: 로컬 개발 코드가 실시간 동기화되도록 볼륨 설정 (`.:/app`)

---

## 2. Docker 빌드 로그 요약

`docker compose -f apps/exporter/compose.yml build` 수행 시:
1. `npm install`을 이용해 패키지 설치 완료 (package-lock.json 미존재 예외 극복)
2. `tsc` 컴파일러를 통해 TypeScript 빌드 성공 (`dist/index.js` 생성 확인)

---

## 3. CLI 실행 검증 결과
`docker compose -f apps/exporter/compose.yml run --rm exporter npm run start -- --help`를 수행한 결과 아래와 같이 도움말이 정상 작동하였습니다:

```
📚 Scraper Exporter CLI
사용법: npm run start -- [옵션]

옵션:
  --target=joplin|obsidian    내보낼 대상 앱 (필수)
  --path=DIRECTORY_PATH       내보낼 책/문서가 들어있는 폴더 경로 (필수)
  --token=JOPLIN_TOKEN        Joplin API 웹클리퍼 토큰 (target이 joplin일 때 필수)
  --key=OBSIDIAN_API_KEY      Obsidian Local REST API 키 (target이 obsidian일 때 필수)
  --addFrontmatter=true|false 각 노트에 프론트매터 자동 추가 여부 (기본값: true)
  --createIndex=true|false    INDEX.md 파일 자동 생성 여부 (기본값: true)

예시:
  # Joplin으로 내보내기
  npm run start -- --target=joplin --path="/app/data/ebook/output/Generative AI on Kubernetes - Roland Huss , Daniele Zonca 2026" --token=abcd1234efgh

  # Obsidian으로 내보내기
  npm run start -- --target=obsidian --path="/app/data/ebook/output/Generative AI on Kubernetes - Roland Huss , Daniele Zonca 2026" --key=your-obsidian-rest-api-key
```

---

## 4. 결론 및 모듈 사용 안내
- `apps/exporter` 패키지는 성공적으로 Monorepo 하위에 이식 및 조립되었습니다.
- 사용자는 `data/ebook` 또는 `data/sites` 등에 수집 완료된 마크다운 결과물 디렉터리를 가리켜 로컬에 설치된 Joplin 또는 Obsidian 앱으로 직접 파일 전송을 진행할 수 있습니다.
