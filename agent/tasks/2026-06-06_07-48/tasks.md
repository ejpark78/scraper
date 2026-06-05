# 📋 Clipper System Restructuring Task List

본 문서는 Scraper-Transform-Loader 리팩토링 단계 중 **PostgreSQL 연동 및 실데이터 적재(Loader)** 단계의 진행 현황을 관리하는 태스크 리스트입니다.

---

## 🟩 Phase 1: MongoDB 리네임 및 백업 (완료)
- [x] 원본 HTML MongoDB 백업 데이터 생성 (`/data/db/backup_pre_migration`)
- [x] MongoDB `renameCollection` 명령을 통해 `bronze.*` 컬렉션을 사이트별 명명 규칙(`linkedin.*`)에 맞게 리네임 완료
  - `bronze.jobs` ➡️ `linkedin.jobs`
  - `bronze.companies` ➡️ `linkedin.companies`

---

## 🟩 Phase 2: 분리형 파이프라인 아키텍처 및 검증 (완료)
- [x] `ScraperWorker.ts` 및 `TransformerWorker.ts` 작성
- [x] Redis 대기열 기반 (`scrape_queue`, `transform_queue`) 비동기 연동 개발
- [x] `InitialBackfill.ts` 마이그레이션 스크립트 작성 및 1차 실행 (Bronze MongoDB HTML ➡️ Silver MongoDB 모킹 적재)
- [x] Docker 환경 내 스크래퍼(2대) 및 트랜스포머(1대) 멀티 복제본 동작 검증 완료

---

## 🟩 Phase 3: PostgreSQL 인프라 구축 및 스키마 정의 (완료)
- [x] `docker/clipper/compose.yml` 또는 루트 `compose.yml` 내 PostgreSQL 컨테이너 구성 및 Private Docker Network 설정
- [x] Silver PostgreSQL 데이터베이스 DDL 및 스키마 설계 (`jobs`, `companies` 등 테이블 정의)
- [x] 데이터베이스 초기화 및 마이그레이션 도구(또는 스크립트) 세팅

---

## 🟩 Phase 4: TargetLoader 실적재 구현 및 검증 (완료)
- [x] Node.js 환경에서 PostgreSQL 연동을 위한 ORM/Query Builder (`pg`) 설치 및 데이터베이스 연결 풀 구성
- [x] `src/TransformerWorker.ts` 내 `TargetLoader` 구현부를 Mock (MongoDB Silver)에서 **실제 PostgreSQL 적재**로 전환
- [x] `src/InitialBackfill.ts` 마이그레이션 스크립트를 수정하여 PostgreSQL로 일괄 백필 처리 실행 중 (실시간 적재 확인 완료)
- [x] PostgreSQL Docker Network 내부 통신 테스트 및 최종 동작 검증
