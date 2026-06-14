# 🚨 DB Diagnostic & Safety Rules (DBDiagnosticRule.md)

이 문서는 에이전트가 로컬 또는 컨테이너 환경의 데이터베이스(MongoDB, Redis 등)를 안전하고 효과적으로 진단하기 위한 규칙을 정의합니다.

---

## 1. 🔌 DB 커넥션 및 셸 실행 환경 제약

1. **호스트 포트 직접 접속 금지**:
   - 인프라 서비스(MongoDB, Redis, Meilisearch 등)의 포트는 호스트 머신에 직접 노출되지 않습니다.
   - 데이터베이스 접속 및 CLI 쿼리는 반드시 Docker 네트워크 환경 내부에서 실행해야 합니다.
   * **허용되는 예시**: `docker compose -p linkedin exec -T mongodb mongosh ...`
   * **금지되는 예시**: 호스트 터미널에서 `mongosh mongodb://localhost:27017` 등으로 접속 시도

2. **커넥션 릭 방지 (Connection Leak)**:
   - Node.js 스크립트나 외부 모듈에서 DB 커넥션을 맺었을 경우, `finally` 블록에서 반드시 DB 연결(`MongoDatabase.close()`, `redis.quit()`)을 닫아 세션이 hang 상태에 빠지지 않도록 해야 합니다.

---

## 2. 📊 MongoDB 조회 및 출력 제약 (LLM 컨텍스트 보호)

1. **대용량 필드 프로젝션 제외 (Projection Limit)**:
   - `bronze.*.html` 컬렉션의 문서를 조회할 때, `rawHtml`, `htmlContent` 등과 같이 대량의 텍스트가 적재된 필드는 터미널 출력 및 LLM 컨텍스트 전송 공간을 낭비시킵니다.
   - 단일 레코드의 메타데이터나 식별자(ID) 정합성을 확인할 때에는 **반드시 대용량 필드를 제외**하는 쿼리를 작성해야 합니다.
   * **권장 쿼리**:
     ```bash
     docker compose -p linkedin exec -T mongodb mongosh bronze --eval "db['uppity.html'].findOne({}, {rawHtml: 0})"
     ```

2. **대량 레코드 출력 금지**:
   - 디버깅 용도로 전체 문서를 배열 형식으로 출력하지 마십시오.
   - 문서가 정상적으로 적재되었는지 또는 상태 분포를 알고 싶을 때는 `countDocuments`나 `aggregate`를 사용하여 통계치만 출력하십시오.
   * **권장 쿼리**:
     ```bash
     docker compose -p linkedin exec -T mongodb mongosh bronze --eval "db['uppity.urls'].countDocuments({status: 'failed'})"
     ```
