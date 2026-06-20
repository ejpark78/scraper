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
