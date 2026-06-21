# 📋 LinkedIn 채용 공고 국가 필터링 활성화/비활성화 계획서 (044-linkedin-country-filter-toggle.plan.md)

## 1. 🎯 개요
LinkedIn 채용 공고 목록 크롤링(`List.ts`) 및 파이프라인 수집 복구(`BasePipeline.ts`) 시, 추출된 채용 정보가 특정 국가에 속하는지 필터링하는 로직이 있습니다. 이 국가 필터링 기능을 활성화 또는 비활성화할 수 있도록 `geo_enable` 설정을 도입합니다.

---

## 2. 🛠️ 변경 계획

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/crawler/src/sites/linkedin/jobs/site.config.ts` | Modify | `GlobalSettings` 인터페이스에 `geo_enable?: boolean;` 프로퍼티 추가 |
| `apps/crawler/src/sites/linkedin/jobs/List.ts` | Modify | `config.json`으로부터 `geo_enable` 설정을 읽고, `false`인 경우 국가 필터링을 건너뛰도록 매칭 로직 수정 |
| `apps/crawler/src/core/BasePipeline.ts` | Modify | `config.json`의 `geo_enable` 설정을 읽어와 `false`일 경우 타겟 국가 필터링(`targetLocations.includes`)을 우회하도록 수정 |
| `apps/crawler/config/config.json` | Modify | `global_settings` 내에 `"geo_enable": true` 명시적 기본값 추가 |

---

## 3. 🔍 상세 설계

### `BasePipeline.ts` 변경
`BasePipeline.ts`의 `urlsFile` 파싱 부분에서 `geo_enable`을 판별하여 `geo_enable: false`일 경우 모든 `DIRECT` 수집 항목을 큐에 포함시킵니다.
```typescript
                    let targetLocations = ['South Korea', 'United Arab Emirates', 'Japan'];
                    let geoEnable = true;
                    try {
                        const configPath = path.join(__dirname, '..', '..', 'config', 'config.json');
                        if (fs.existsSync(configPath)) {
                            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                            if (config.global_settings && config.global_settings.geo_enable !== undefined) {
                                geoEnable = config.global_settings.geo_enable;
                            }
                            if (config.search_targets) {
                                targetLocations = config.search_targets
                                .filter((t: any) => t.enabled !== false)
                                .map((t: any) => t.location);
                            }
                        }
                    } catch (e) {}

                    jobsList.forEach((job: any) => {
                        if (job.source === 'DIRECT' && (!geoEnable || targetLocations.includes(job.geo))) {
                            // ...
```
