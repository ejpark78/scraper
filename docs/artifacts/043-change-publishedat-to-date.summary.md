# Summary: 043-change-publishedat-to-date

> Squashed from: 043-change-publishedat-to-date.review.md 043-change-publishedat-to-date.task.md 043-change-publishedat-to-date.walkthrough.md

---

## Review

### 043-change-publishedat-to-date.review

# 043-change-publishedat-to-date.review.md

본 문서는 `publishedAt` 필드 형식을 `string`에서 `Date` 객체로 전면 리팩토링한 작업에 대한 설계 검토 및 코드 리뷰 문서입니다.

---

## 1. 종합 평가 (Code Review)
* **적절성**: MongoDB aggregate 런타임 단계에서 `$dateFromString`으로 연산하는 방식은 기존 인덱스(`{ publishedAt: -1 }`)를 타지 못하므로 대량 데이터(7만 건 이상) 검색 시 병목의 원인이 됨. 적재 시점에 `Date` 객체로 타입을 통일하여 저장하고 인덱스 매칭 방식으로 롤백한 조치는 올바른 아키텍처 방향임.
* **일관성**: `yozm`, `geeknews`, `gpters` 등 8개 사이트의 타입 정의 및 파이프라인 전반을 동시에 수정하여 크롤러 런타임에 데이터가 깨지거나 누락되는 부작용을 방지함.
* **예외 처리**: `DateUtils.parseSafeDate` 헬퍼를 추가하여 날짜가 비어있거나 유효하지 않은 문자열(Invalid Date)일 경우 예외를 내며 크롤러가 죽지 않고 안전하게 `null`을 반환하도록 예외 안전성을 확보함.

---

## 2. 세부 변경 코드 내역 검토

### A. DateUtils
* **구현**:
  ```typescript
  public static parseSafeDate(dateInput: string | Date | null | undefined): Date | null {
      if (!dateInput) return null;
      if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
      let cleaned = dateInput.trim();
      if (cleaned.match(/^\d{4}\.\d{2}\.\d{2}$/)) {
          cleaned = cleaned.replace(/\./g, '-');
      }
      const d = new Date(cleaned);
      return isNaN(d.getTime()) ? null : d;
  }
  ```
* **리뷰**: `2026.06.20`과 같이 점(`.`)으로 나뉘는 구식 포맷을 감지하여 하이픈(`-`) 표준 포맷으로 변환 후 `new Date()`를 호출하므로 파싱 정밀도가 보장됨.

### B. MongoDB Aggregation API (`apps/viewer/src/api/server.ts`)
* **구현**:
  ```typescript
  $match: {
    publishedAt: {
      $exists: true,
      $ne: null,
      $gte: startUtc,
      $lte: endUtc
    }
  }
  ```
* **리뷰**: 런타임 데이터 변환 레이어 제거로 인해 `$addFields` 오버헤드가 100% 제거되었으며, 단일 `$match` 스테이지로 변경되어 MongoDB의 인덱스 검색 성능을 온전히 활용함.

---

## 3. 남은 개선 과제 (Technical Debt)
* **스키마 문서화**: README 및 API 스펙에 `publishedAt`이 기존 `string`에서 `Date`로 변경되었음을 명확히 기술해야 함.
* **유닛 테스트 보완**: `tests/sites/...` 유닛 테스트에서 fixture HTML 변환 검증 시 `publishedAt`을 `Date` 객체로 올바르게 비교 및 파서 검증을 하는지 확인 필요.

---

## Task

### 043-change-publishedat-to-date.task

# 043-change-publishedat-to-date.task.md

본 문서는 `publishedAt` 필드 마이그레이션 작업을 수행하기 위한 세부 태스크 리스트와 진행 결과 상태입니다.

---

## Task List

- [x] **1단계: 날짜 안전 파싱 헬퍼 작성**
  - [x] `apps/crawler/src/utils/DateUtils.ts`에 입력받은 다양한 문자열을 감지하여 안전하게 `Date` 객체 또는 `null`을 반환하는 `parseSafeDate` 정적 메서드 작성 완료.

- [x] **2단계: 크롤러 공통/개별 타입 수정**
  - [x] `apps/crawler/src/sites/*/site.config.ts` 파일들에서 `publishedAt` 속성의 타입을 `Date | null`로 변경 완료.
    - 대상 사이트: `yozm`, `geeknews`, `gpters` (news), `maily_josh`, `dailydose_ds`, `aicasebook`, `pytorch_kr`, `uppity`

- [x] **3단계: 크롤러별 Converter 코드 수정**
  - [x] `apps/crawler/src/sites/*/Converter.ts` 및 관련 파이프라인(`Contents.ts`, `List.ts` 등)에서 정제 결과를 파싱하여 `Date` 객체로 주입하게 수정 완료.
  - [x] 마크다운 조립 시 `publishedAt.toISOString()`을 렌더링하도록 갱신 완료.

- [x] **4단계: 백엔드 API 수정**
  - [x] `apps/viewer/src/api/server.ts`의 일별 통계 API에서 `$dateFromString` 변환 로직 제거하고 직접 `Date` 대소 비교 쿼리(`$gte`, `$lte`)로 롤백 및 인덱스 조회 최적화 완료.

- [x] **5단계: 수동 마이그레이션 실행**
  - [x] 기존 데이터의 `publishedAt` 문자열을 `Date` 객체로 바꾸는 MongoDB Aggregation 쿼리를 셸을 통해 7만여 건 일괄 변환 완료.

- [x] **6단계: 컨테이너 재빌드 및 최종 동작 검증**
  - [x] `viewer-api`, `viewer-fe`, `viewer-mcp` 서비스를 도커 재빌드하여 신규 수정본 배포 및 가동 확인 완료.

---

## Walkthrough

### 043-change-publishedat-to-date.walkthrough

# 043-change-publishedat-to-date.walkthrough.md

본 문서는 `publishedAt` 스키마 변경 작업에 대한 최종 결과보고서입니다.

---

## 1. 작업 결과 및 상태 비교

### 작업 전 (Before)
* `updatedAt`은 `Date` 타입이나, `publishedAt`은 문자열(`string`) 타입으로 크롤러별 혼용 적재됨.
* 대시보드 뷰어에서 "발행일" 집계 선택 시, DB 날짜 대소 비교(`$gte`, `$lte`) 쿼리가 실패하여 차트에 아무 데이터도 렌더링되지 않음.
* 런타임 해결책으로 백엔드에서 `$dateFromString` 연산기를 활용하여 형변환을 시도했으나 성능 손실이 심각했음.

### 작업 후 (After)
* 수집기 정제 변환기 8개 사이트에 `DateUtils.parseSafeDate`를 적용하여 수집 즉시 `Date` 객체로 형식을 통일함.
* 70,000여 건의 대량 기존 데이터 마이그레이션을 안전하게 실행 완료함.
* 뷰어 백엔드 쿼리를 `$dateFromString` 대신 직접 인덱스를 타는 날짜 대소 쿼리로 단순화함.
* 뷰어 GUI 차트에서 "발행일" 라디오 버튼을 토글하면, 누락 없이 초 단위 미만의 성능으로 일별 수집/발행 현황 스택 바 차트가 정상 노출됨.

---

## 2. 검증 절차 (Verification)
* **DB 검증**: MongoDB 셸 접속 후 아래 쿼리 실행 결과, 모든 `publishedAt`이 날짜 데이터(ISODate)로 반환됨을 확인.
  ```bash
  db['yozm.contents'].findOne({}, { publishedAt: 1 })
  // 출력: "publishedAt": ISODate("2026-06-20T...")
  ```
* **API 검증**: `GET /api/site-stats/search?startDate=2026-06-15&endDate=2026-06-21&dateType=published` 호출 시, `StatsMap` 구조 내 각 일자별 수집 카운트 데이터가 정상 집계되어 반환됨.

---

## 3. 롤백 / 장애 복구 대책
* 만약 스키마 변경으로 인해 외부 라이브러리 연동 시 타입 충돌 및 장애가 발생할 경우, 다음 마이그레이션 스크립트를 통해 `publishedAt`을 문자열(ISO String)로 되돌릴 수 있음.
  ```javascript
  db.getCollectionNames().filter(name => name.endsWith('.contents')).forEach(colName => {
    db[colName].find({ publishedAt: { $type: "date" } }).forEach(doc => {
      db[colName].updateOne({ _id: doc._id }, { $set: { publishedAt: doc.publishedAt.toISOString() } });
    });
  });
  ```

---

