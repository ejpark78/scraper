# 💡 DB 인덱스 및 스키마 진단 기술 (DatabaseSkills.md)

이 문서는 MongoDB 인덱스 불일치 및 컬렉션의 스키마 구조 정합성을 진단하기 위한 실무 기술 및 CLI 가이드를 정의합니다.

---

## 1. 🔄 MongoDB 인덱스 동기화 및 검증

MongoDB의 컬렉션 인덱스가 `site.config.ts`에 선언된 규격과 다를 경우 쿼리 속도 저하 또는 전문 검색 오류가 발생합니다.

### 1.1 동기화 스크립트 실행
컨테이너 환경 내에서 인덱스를 동기화하고 상태를 터미널로 받아보려면 아래 명령을 사용합니다:
```bash
docker compose -p linkedin run --rm \
  -v $(pwd):/app -v /app/node_modules \
  worker npx ts-node src/scripts/sync-indexes.ts
```

### 1.2 주요 점검 항목
- `bronze.html`, `bronze.urls`, `silver.contents`에 각각 고유 인덱스(`{ id: 1 }`, unique)가 유효하게 생성되었는지 확인합니다.
- `silver.contents`에 full-text 검색용 `text` 인덱스(`title`, `markdown`)가 적용되어 있는지 검사합니다.

---

## 2. 📊 데이터베이스 컬렉션 필드 스키마 분석

수집 방식이 상이한 여러 사이트의 필드가 정상적으로 매핑되었는지 교차 검증할 수 있습니다.

### 2.1 스키마 매핑 보고서 출력
```bash
docker compose -p linkedin run --rm \
  -v $(pwd):/app -v /app/node_modules \
  worker npx ts-node src/scripts/show_collection_columns.ts
```
- 실행 완료 시, 데이터베이스(`bronze`, `silver`) 내 모든 컬렉션의 필드명을 가로(사이트), 세로(필드명)로 매핑한 Markdown 표가 출력되어 한눈에 정합성을 점검할 수 있습니다.

---

## 3. 🖥️ mongosh 활용 핵심 진단 쿼리

컨테이너 환경 외부에서 DB 포트 포워딩 없이 빠르게 상태를 점검할 수 있는 원라인(One-line) 스니펫입니다.

- **사이트별 수집 건수 동시 확인**:
  ```bash
  docker compose -p linkedin exec -T mongodb mongosh bronze --eval "print('html count:', db['uppity.html'].countDocuments(), 'urls count:', db['uppity.urls'].countDocuments())"
  ```
- **수집 오류(failed 상태) 레코드 1건 메타데이터 조회**:
  ```bash
  docker compose -p linkedin exec -T mongodb mongosh bronze --eval "db['uppity.urls'].findOne({status: 'failed'}, {rawHtml: 0})"
  ```
- **해시 ID 검증을 위한 ID 검색**:
  ```bash
  docker compose -p linkedin exec -T mongodb mongosh bronze --eval "db['uppity.urls'].findOne({id: '887e626b6b08089a95df068adbd103d5'})"
  ```
