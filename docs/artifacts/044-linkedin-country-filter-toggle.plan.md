# 📋 LinkedIn 채용 공고 국가 필터링 활성화/비활성화 및 URL 리프레시 복구 계획서 (044-linkedin-country-filter-toggle.plan.md)

## 1. 🎯 개요
1. LinkedIn 채용 공고 목록 크롤링(`List.ts`) 및 파이프라인 수집 복구(`BasePipeline.ts`) 시, 추출된 채용 정보가 특정 국가에 속하는지 필터링하는 로직이 있습니다. 이 국가 필터링 기능을 활성화 또는 비활성화할 수 있도록 `geo_enable` 설정을 도입합니다.
2. `make li-refresh-urls` 명령어를 실행할 때, LinkedIn 디스크립터에 `domain` 설정과 `urlsCollectionName` 설정이 누락되어 리프레시 HTML 스캔 로직(`scanHtmlForUrls`)이 실행되지 않던 현상을 해결합니다.
3. 빌드 과정에서 발생한 `urlsCollectionName` 속성 타입 에러(`SiteDescriptor` 루트 레벨에 추가하여 발생)를 해결하기 위해 해당 속성을 `descriptor.scraper` 블록 내부로 이동합니다.
4. `scraper` 워커 이미지 빌드 시 사용하는 베이스 이미지의 Playwright 버전(`v1.60.0-jammy`)을, 현재 설치된 `1.61.0` 버전에 맞추어 `v1.61.0-jammy`로 업그레이드하여 브라우저 실행 파일 불일치 에러를 방지합니다.

---

## 2. 🛠️ 변경 계획

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/crawler/src/sites/linkedin/jobs/site.config.ts` | Modify | - `GlobalSettings` 인터페이스에 `geo_enable?: boolean;` 프로퍼티 추가<br>- `descriptor`에 `domain: 'www.linkedin.com'` 지정<br>- `descriptor.scraper` 내부에 `urlsCollectionName: 'bronze/linkedin.job_urls'` 지정 (루트 레벨에서 이동) |
| `apps/crawler/src/sites/linkedin/jobs/List.ts` | Modify | `config.json`으로부터 `geo_enable` 설정을 읽고, `false`인 경우 국가 필터링을 건너뛰도록 매칭 로직 수정 |
| `apps/crawler/src/core/BasePipeline.ts` | Modify | `config.json`의 `geo_enable` 설정을 읽어와 `false`일 경우 타겟 국가 필터링(`targetLocations.includes`)을 우회하도록 수정 |
| `apps/crawler/config/config.json` | Modify | `global_settings` 내에 `"geo_enable": true` 명시적 기본값 추가 |
| `apps/crawler/docker/worker/scraper/Dockerfile` | Modify | 베이스 이미지를 `mcr.microsoft.com/playwright:v1.60.0-jammy`에서 `mcr.microsoft.com/playwright:v1.61.0-jammy`로 변경 |

---

## 3. 🔍 상세 설계

### `scraper/Dockerfile` 변경
`apps/crawler/docker/worker/scraper/Dockerfile`의 7번째 줄 변경:
```dockerfile
FROM mcr.microsoft.com/playwright:v1.61.0-jammy
```
