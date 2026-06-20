# 043-change-publishedat-to-date.plan.md

본 계획서는 MongoDB 내 수집된 콘텐츠의 발행일(`publishedAt`) 필드를 기존 `string | null`에서 정적 `Date` 객체 형식으로 변경하는 작업 절차를 정의합니다.

---

## 1. 개요 및 목적
* **현황**: `updatedAt`(수집일)은 MongoDB `Date` 형식인 반면, `publishedAt`(발행일)은 크롤러별로 다양한 형태의 문자열(`string`)로 저장됨.
* **문제점**: 날짜 검색, 대소 비교(`$gte`, `$lte`), 일별 집계 시 런타임 변환 오버헤드 발생 및 데이터 형식의 불일치로 집계 누락 가능성 상존.
* **목표**: `publishedAt`을 DB 레벨에서 완전히 `Date` 객체로 변경하고, 크롤러 수집 파이프라인(Converter) 및 기존 적재 데이터 일괄 마이그레이션을 수행하여 데이터 정형성을 확보함.

---

## 2. 변경 영향도 및 대처 방안

### A. TypeScript 타입 정의
* 크롤러 사이트별 `site.config.ts` 및 핵심 모델의 `publishedAt?: string` 또는 `publishedAt: string | null`을 `publishedAt: Date | null`로 변경.

### B. Converter (변환기) 수정
* HTML을 Markdown으로 변환하여 `silver` DB에 저장하는 각 사이트 컨버터(`apps/crawler/src/sites/.../Converter.ts`)가 `Date` 혹은 `null`을 반환하도록 수정.
* `new Date(dateString)` 변환 시 유효하지 않은 날짜(Invalid Date)를 걸러내고 `null`을 할당하도록 유틸리티 함수 적용.

### C. MongoDB 데이터 마이그레이션
* 사용자가 직접 MongoDB 셸(`mongosh`) 또는 일회성 스크립트를 통해 기존 컬렉션의 `publishedAt` 값을 `$dateFromString` 연산자를 활용해 `Date` 객체로 업데이트.
* **안전 제약**: 에이전트가 임의로 DB 데이터를 수정하지 않고 마이그레이션 명령어만 작성하여 제공한 후 사용자가 직접 실행.

---

## 3. 세부 파일 변경 대상 리스트

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/crawler/src/utils/DateUtils.ts` | Modify / Create | 날짜 문자열을 안전하게 Date 객체로 파싱하는 공통 헬퍼 추가 |
| `apps/crawler/src/sites/*/site.config.ts` | Modify | 사이트별 스키마 메타데이터에서 `publishedAt` 타입을 `Date \| null`로 변경 |
| `apps/crawler/src/sites/*/Converter.ts` | Modify | 수집 시 `publishedAt`을 문자열이 아닌 `Date`로 반환하도록 변경 |
| `apps/viewer/src/api/server.ts` | Modify | 백엔드 집계 API에서 발행일 기준 검색 시 런타임 변환 단계를 빼고 인덱스를 활용한 다이렉트 `$gte` / `$lte` 쿼리 수행 |

---

## 4. 기존 데이터 마이그레이션 쿼리 (MongoDB)

사용자가 MongoDB 컨테이너에 접속하여 실행할 마이그레이션 쿼리 예시:

```javascript
// 각 사이트 silver.*.contents 컬렉션을 일괄 마이그레이션하는 mongosh 스크립트
const collections = db.getCollectionNames().filter(name => name.endsWith('.contents'));
collections.forEach(colName => {
  print("Migrating: " + colName);
  db[colName].find({ publishedAt: { $type: "string" } }).forEach(doc => {
    let parsedDate = null;
    if (doc.publishedAt) {
      const d = new Date(doc.publishedAt);
      if (!isNaN(d.getTime())) {
        parsedDate = d;
      }
    }
    db[colName].updateOne({ _id: doc._id }, { $set: { publishedAt: parsedDate } });
  });
});
```
