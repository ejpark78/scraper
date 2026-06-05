# 📓 Kaggle Reference Memo (LinkedIn Job & Company Data)

본 문서는 현재 개발 중인 **LinkedIn Job & Company Clipper** 프로젝트와 유사한 Kaggle 데이터셋 및 분석 사례를 정리한 참고 메모입니다. 수집 데이터 스키마 설계 및 향후 데이터 분석/활용 단계에서 참고할 수 있습니다.

---

## 1. 주요 Kaggle 데이터셋 리스트

### 💼 [LinkedIn Job Postings (2023 - 2024)](https://www.kaggle.com/datasets/arshkon/linkedin-job-postings)
* **특징**: 약 12만 개 이상의 채용 공고와 회사 메타데이터를 포함한 가장 대표적인 데이터셋입니다.
* **프로젝트 매칭**: 
  * `silver.jobs`에 적재 중인 정제 메타데이터(직무명, 급여, 위치, 근무 형태 등) 설계와 100% 매칭됩니다.
  * 데이터가 `job_postings.csv`, `companies.csv`, `job_skills.csv` 등으로 정규화되어 있어, MongoDB의 `jobs`와 `companies` 간의 관계 설정(DBRef/ID 매핑) 시 모범 사례로 참고하기 좋습니다.

### 🏢 [LinkedIn Company Data](https://www.kaggle.com/datasets/peopledatalabs/linkedin-company-dataset)
* **특징**: 전 세계 수백만 개의 LinkedIn 등록 회사 프로필 데이터셋입니다.
* **프로젝트 매칭**: 
  * `src/company/` (CompanyPipeline) 도메인에서 수집하는 회사 상세 정보(산업군, 직원 수, 본사 위치 등)와 일치합니다.

### 🤖 [AI & ML Job Postings Dataset (2025)](https://www.kaggle.com/datasets/dfalathe/ai-ml-job-postings-dataset-2025)
* **특징**: 2025년 기준 인공지능 및 머신러닝 분야의 채용 정보만 중복 제거하여 타겟팅한 데이터셋입니다.
* **프로젝트 매칭**: 
  * Redis Queue(`jobs_queue`)와 MongoDB 중복 방지 필터를 사용하여 특정 분야/국가 채용 공고를 꼬리물기 방식으로 정밀 수집하는 파이프라인의 최종 정제 결과물 규격으로 삼기에 적합합니다.

---

## 2. 추천 분석 노트북 & 오픈소스 참고 코드

수집한 마크다운 문서 및 MongoDB 적재 데이터를 바탕으로 향후 시도해볼 수 있는 분석 기법과 참고 코드 링크입니다.

* **NLP 기반 기술 스택 (Skills) 추출 및 분석**
  * [Kaggle Notebook: Extracting Skills from Job Descriptions](https://www.kaggle.com/code/arshkon/extracting-skills-from-job-descriptions)
  * 수집한 채용 공고 본문(마크다운)에서 자연어 처리(NLP) 및 NER을 활용해 핵심 기술 스택 요소를 분류하는 코드입니다.
* **채용 시장 시각화 분석 (EDA)**
  * [Kaggle Notebook: LinkedIn Jobs EDA & Visualization](https://www.kaggle.com/code/joshuaswords/linkedin-jobs-eda-interactive-map)
  * 위치(Location) 데이터를 지도에 매핑하고 근무 형태(Remote/Hybrid)별 급여 분포를 시각화하는 인터랙티브 대시보드 예제입니다.
* **LinkedIn Scraper 오픈소스 레퍼런스 (Python)**
  * [GitHub: ArshKA/LinkedIn-Job-Scraper](https://github.com/ArshKA/LinkedIn-Job-Scraper)
  * 게스트 API (`/jobs-guest/jobs/api/seeMoreJobPostings/search`) 활용 및 페이징 처리를 참고할 수 있는 파이썬 구현체입니다.

---

## 3. Kaggle 데이터셋 다운로드 및 설치 안내 (수동)

Kaggle 정책상 데이터셋 다운로드 시 로그인이 요구되므로, 아래 단계에 따라 다운로드하여 `data/` 경로에 배치해 주시기 바랍니다.

1. **데이터셋 페이지 접속 및 다운로드**:
   * [LinkedIn Job Postings (2023 - 2024)](https://www.kaggle.com/datasets/arshkon/linkedin-job-postings) 페이지에 접속합니다.
   * 우측 상단의 **Download** 버튼을 클릭하여 `archive.zip` 파일을 다운로드합니다.
2. **프로젝트 경로에 압축 해제**:
   * 다운로드받은 zip 아카이브의 압축을 풀고, 포함된 CSV 파일들을 프로젝트의 `data/` 디렉토리에 위치시킵니다.
   * 올바른 파일 구조:
     ```text
     linkedin/
     └── data/
         ├── job_postings.csv
         ├── companies.csv
         ├── job_skills.csv
         └── ...
     ```

