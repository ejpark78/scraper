# 📋 Plan: Fix Viewer Sites Configuration Loading

이 계획은 `viewer` 서비스가 빌드 컨텍스트 제한으로 인해 사이트 메타데이터(`config/sites.json`)를 참조하지 못해 발생하는 Meilisearch 인덱스 조회 실패 버그(Bugfix)를 근본적으로 해결하기 위한 계획입니다.

## 1. 문제 분석
- `viewer-api` 서비스의 빌드 컨텍스트(`context`)는 `apps/viewer` 로 제한되어 있어, 프로젝트 전체 루트의 `config/sites.json` 이 컨테이너 빌드 시에 복사되지 못했습니다.
- 설령 파일이 복사되었다 하더라도, 컨테이너 내부 디렉토리 기준(`/app/src/core/` 하위에서 `..` 4개 위를 조회) 경로 계산이 빗나가 `/config/sites.json` 이라는 잘못된 경로를 참조하게 됩니다.
- 결과적으로 `discoverSites()` 가 실패하여 사이트 등록이 누락되었고, Meilisearch `linkedin` 인덱스 404 오류가 지속되었습니다.

## 2. 해결 방안
- `generate-sites-config.ts` 스크립트 실행 시 정적 설정 파일을 프로젝트 루트(`config/sites.json`) 뿐만 아니라 **`apps/viewer/config/sites.json`** 에도 이중 기록하도록 수정합니다.
- `apps/viewer/src/core/SiteRegistry.ts` 파일의 `staticConfigPath` 조회 상대 경로를 `..` 2단계 위(`__dirname` 기준 `/app/config/sites.json` 또는 `apps/viewer/config/sites.json` 이 가리켜지도록)로 정밀 수정합니다.
- 조치 완료 후 메타데이터를 다시 빌드하고 뷰어 서비스를 리빌드합니다.

## 3. 작업 계획

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/crawler/src/scripts/generate-sites-config.ts` | Modify | `config/sites.json` 생성 시 `apps/viewer/config/sites.json` 경로에도 이중 기록하도록 추가 |
| `apps/viewer/src/core/SiteRegistry.ts` | Modify | `staticConfigPath` 상대 경로를 `..` 2개 수준 위로 교정 |

## 4. 변경 예정 코드 상세

### `apps/crawler/src/scripts/generate-sites-config.ts`
```typescript
  // 변경 후
  const rootConfigDir = path.resolve(__dirname, '..', '..', '..', '..', 'config');
  const viewerConfigDir = path.resolve(__dirname, '..', '..', '..', '..', 'apps', 'viewer', 'config');
  
  [rootConfigDir, viewerConfigDir].forEach(configDir => {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const outputPath = path.join(configDir, 'sites.json');
    fs.writeFileSync(outputPath, JSON.stringify(staticConfigs, null, 2), 'utf8');
    console.log(`✅ Static sites configuration written to: ${outputPath}`);
  });
```

### `apps/viewer/src/core/SiteRegistry.ts`
```typescript
  // 변경 후
  const staticConfigPath = path.resolve(__dirname, '..', '..', 'config', 'sites.json');
```
