# 📝 [Plan] 뷰어 익스포터 설정 통합 및 타입 사양 개선 계획서

본 계획서는 `apps/viewer` 패키지 내 Joplin 내보내기 모듈의 환경 변수 참조 일원화 및 변수 선언 시 타입 사양을 명시적으로 교정하여 타입 안전성을 복구하기 위한 상세 방안을 기술합니다.

---

## 📅 1. 작업 범위 및 대상 파일

1. **Joplin 설정 변수 중앙화**
   - 대상: [apps/viewer/src/config/AppConfig.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/config/AppConfig.ts)
   - 작업: `JOPLIN_API_URL` 환경 변수 속성을 AppConfig의 읽기 전용 상수로 정식 등록 (기본값: `'http://host.docker.internal:41184'`).

2. **Joplin 익스포터 하드코딩 제거 및 타입 정의**
   - 대상: [apps/viewer/src/exporter/export/joplin.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/exporter/export/joplin.ts)
   - 작업:
     - `process.env.JOPLIN_API_URL` 대입부를 `AppConfig.JOPLIN_API_URL` 사용으로 수정.
     - `let bookFolder;` 형식으로 선언되어 암묵적으로 `any`로 추론되던 임시 변수를 `let bookFolder: { id: string };` 형태로 정적 바인딩.

---

## 🛠️ 2. 상세 구현 설계

### A. [AppConfig.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/config/AppConfig.ts) 변경
```typescript
export class AppConfig {
    // ... 기존 설정
    
    /**
     * Joplin API Web Clipper URL
     */
    public static readonly JOPLIN_API_URL: string = process.env.JOPLIN_API_URL || 'http://host.docker.internal:41184';
}
```

### B. [joplin.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/exporter/export/joplin.ts) 변경
```typescript
import { AppConfig } from '../../config/AppConfig';

const JOPLIN_API_URL = AppConfig.JOPLIN_API_URL;

export async function exportToJoplin(...) {
    // ...
    let bookFolder: { id: string };
    try {
        bookFolder = await createBookFolder(book.title, token, targetApiUrl);
    } // ...
}
```

---

## 📈 3. 검증 계획

- **빌드 테스트**: `apps/viewer` 패키지 수준의 컴파일 오류 진단 (`npx tsc --noEmit --project tsconfig.json` in `apps/viewer`)
