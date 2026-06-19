# 🎯 Project Goals & Roadmap (GOAL.md)

이 프로젝트는 **LinkedIn 채용 공고, 메일링 리스트, 기술 서적** 등 흩어져 있는 기술 지식과 정보를 수집 및 구조화하고, 검색 및 LLM 기반 요약/분석을 통해 개발자를 위한 **통합 기술 지식 허브 & 분석 위키(Information Hub & Wiki)**를 구축하는 것을 최종 목표로 합니다.

---

## 👁️ Core Vision (핵심 비전)
1. **분산된 정보의 중앙화**: 웹 크롤러, PDF 파서, Gmail API 등을 통해 유용한 기술 지식을 한데 모읍니다.
2. **AI-Assisted Processing**: 수집된 비정형 데이터(HTML, PDF, 이메일)를 정교한 마크다운 및 JSON 구조로 정제합니다.
3. **고속 시맨틱 검색**: Meilisearch를 연동하여 고유 텍스트 검색 및 의미론적 지식 탐색을 제공합니다.
4. **트렌드 요약 리포팅**: 축적된 기술 트렌드 데이터를 LLM으로 분석하여 인사이트 리포트를 정기 생성합니다.

---

## 🗺️ Milestone Roadmap (마일스톤 로드맵)

```mermaid
gantt
    title 프로젝트 로드맵 및 마일스톤
    dateFormat  YYYY-MM-DD
    section 완료된 파이프라인
    모노레포 개편 & Ebook 통합 (M1)   :done, des1, 2026-06-01, 2026-06-19
    LinkedIn 수집 파이프라인 구축 (M2) :done, des2, 2026-06-01, 2026-06-19
    뉴스레터/메일링 자동 수집 (M3)      :done, des3, 2026-06-01, 2026-06-19
    section 진행 예정 (AI & 리포팅)
    통합 검색 및 LLM 트렌드 분석 (M4) :active, des4, 2026-06-20, 2026-07-20
```

### ✅ Milestone 1: 모노레포 아키텍처 개편 및 Ebook 서비스 통합 (완료)
* **목표**: 흩어져 있던 `scraper`와 `ebook` 코드를 단일 모노레포 구조로 통합하고 인프라(Docker Compose Profiles) 격리 완료.
* **산출물**:
  - `apps/crawler`, `apps/ebook`, `apps/viewer` 프로젝트 이관 및 뼈대 구축 완료.
  - Ebook 마크다운 데이터를 MongoDB/Meilisearch로 일괄 적재하는 `sync-ebooks.ts` 파이프라인 구축 완료.

### ✅ Milestone 2: LinkedIn Jobs & Company 수집 엔진 구축 (완료)
* **목표**: 채용 정보 및 기업 데이터를 Playwright를 기반으로 수집하여 인맥 및 구인 트렌드 데이터베이스 구축 완료.
* **산출물**:
  - `apps/crawler/src/sites/linkedin` 하위의 Jobs/Company 스크래퍼 및 데이터 적재 완료.

### ✅ Milestone 3: 기술 뉴스레터 및 메일링 리스트 수집 자동화 (완료)
* **목표**: Gmail API 연동 및 구독 뉴스레터 자동 필터링/아카이빙 시스템 구축 완료.
* **산출물**:
  - Maily(josh), GeekNews, GPTers, PyTorch KR, Uppity, Yozm 등 뉴스레터/포스팅 통합 적재 스크립트 및 스케줄링 구축 완료.

### ⏳ Milestone 4: 통합 검색 고도화 및 LLM 트렌드 분석 리포팅 (진행 예정)
* **목표**: 수집된 뉴스레터, Ebook, LinkedIn 지식 기반의 고성능 시맨틱 검색 UX를 구축하고, 축적된 데이터를 LLM을 통해 정기적으로 분석/요약하여 개발자 기술 트렌드 주간/월간 리포팅 엔진을 구축합니다.
* **산출물**:
  - `apps/viewer` 내 통합 검색 인터페이스 구현 및 Meilisearch 하이브리드 검색 튜닝.
  - GPT 등 LLM 연동을 통한 최신 기술 동향 요약 및 자동 분석 리포팅 파이프라인 개발.
