# 📋 Plan: Fix Static Sites Configuration Generation Path

이 계획은 `viewer`가 Meilisearch에서 `linkedin` 인덱스를 찾지 못하는 404 오류(Bugfix)를 해결하기 위해, 정적 사이트 목록 메타데이터(`config/sites.json`)의 생성 경로를 교정하고 뷰어에 반영되도록 하는 계획입니다.

## 1. 문제 분석
- `viewer` 서비스는 가벼운 구성 로드를 위해 빌드 타임에 이미지에 탑재된 `config/sites.json`을 사용하여 각 사이트의 `indexName`을 읽어옵니다.
- `apps/crawler/src/scripts/generate-sites-config.ts` 스크립트에서 이 메타데이터를 추출하여 기록하지만, 경로 탐색 수준 미스매치로 인해 프로젝트 루트의 `config/sites.json`이 아닌 `apps/crawler/config/sites.json` 에 생성되고 있었습니다.
- 결과적으로 프로젝트 루트의 `config/sites.json`이 누락되거나 동기화되지 않았으며, `viewer`의 `SiteRegistry` 가 사이트 정보를 로드하지 못해 LinkedIn의 올바른 인덱스 명칭인 `linkedin_jobs` 대신 `linkedin`으로 Meilisearch 조회를 시도하여 404 API 오류가 발생하게 되었습니다.

## 2. 해결 방안
- `generate-sites-config.ts` 스크립트의 출력 디렉토리 경로를 프로젝트 루트인 `config/sites.json`이 되도록 3계층 상위(Relative path `..` 추가)로 수정합니다.
- 조치 완료 후, 호스트(로컬)에서 스크립트를 구동하여 `config/sites.json`을 새로 작성합니다.
- `viewer` 서비스 이미지를 새로 빌드(`make rebuild`)하여 정상 동작을 확인합니다.

## 3. 작업 계획

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/crawler/src/scripts/generate-sites-config.ts` | Modify | `configDir` 절대 경로 해석 시 `..` 계층 하나 추가 (`..` ➡️ `..` 3개) |

## 4. 변경 예정 코드 상세

### `apps/crawler/src/scripts/generate-sites-config.ts` (변경 전)
```typescript
  const configDir = path.resolve(__dirname, '..', '..', 'config');
```

### `apps/crawler/src/scripts/generate-sites-config.ts` (변경 후)
```typescript
  const configDir = path.resolve(__dirname, '..', '..', '..', 'config');
```
