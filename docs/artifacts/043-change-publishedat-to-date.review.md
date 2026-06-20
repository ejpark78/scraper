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
