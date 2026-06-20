# 📋 Plan: Fix LinkedIn List Scraper Argument Handling

이 계획은 `make li-list` 실행 시 인자로 숫자가 넘어와 `configFilePath`가 존재하지 않아 생기는 치명적인 에러를 해결하기 위해 `src/sites/linkedin/jobs/List.ts`의 CLI 인수 파싱 로직을 보정하는 계획입니다.

## 1. 문제 분석
- `make li-list`를 호출할 때 `ts-node src/cli-list.ts --site linkedin --page 1 --list-slack 2`가 실행됩니다.
- `cli-list.ts`에서는 `page` 값 `"1"`을 LinkedIn `List.ts`에 인자로 전달하여 `ts-node src/sites/linkedin/jobs/List.ts 1`이 최종 실행됩니다.
- LinkedIn `List.ts`에서는 인자(`process.argv[2]`)를 설정 파일 경로(`configFilePath`)로 취급하는데, `"1"`이라는 설정 파일이 없으므로 `fs.existsSync("1")` 조건 검사에서 에러(`Error: 지정한 입력 대상 설정 파일을 찾을 수 없습니다: 1`)를 뿜으며 실행이 중단됩니다.

## 2. 해결 방안
- `src/sites/linkedin/jobs/List.ts`의 메인 실행부(`require.main === module`)에서 인자로 받은 값이 숫자 패턴(`/^\d+$/`)인 경우, 페이지 번호로 간주하여 설정 파일 경로를 기본 경로인 `'config/config.json'`으로 우회 지정하도록 수정합니다.

## 3. 작업 계획

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/crawler/src/sites/linkedin/jobs/List.ts` | Modify | `process.argv[2]`가 숫자인 경우 기본 설정 경로인 `'config/config.json'`을 사용하도록 보정 로직 추가 |

## 4. 변경 예정 코드 상세

### `apps/crawler/src/sites/linkedin/jobs/List.ts` (변경 전)
```typescript
if (require.main === module) {
    const configFile = process.argv[2] || 'config/config.json';
    const scraper = new LinkedInList();
```

### `apps/crawler/src/sites/linkedin/jobs/List.ts` (변경 후)
```typescript
if (require.main === module) {
    let configFile = process.argv[2] || 'config/config.json';
    if (configFile && /^\d+$/.test(configFile)) {
        configFile = 'config/config.json';
    }
    const scraper = new LinkedInList();
```
