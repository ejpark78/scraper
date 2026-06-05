-- ==============================================================================
-- 🏛️ PostgreSQL Silver Layer Database Schema DDL
-- ==============================================================================

-- 1. Jobs Table (채용 정보 테이블)
CREATE TABLE IF NOT EXISTS jobs (
    job_id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    company_id VARCHAR(100),
    description TEXT,
    location VARCHAR(255),
    geo VARCHAR(100),
    work_style VARCHAR(50),
    url TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_geo ON jobs(geo);

-- 2. Companies Table (기업 정보 테이블)
CREATE TABLE IF NOT EXISTS companies (
    company_id VARCHAR(100) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    tagline TEXT,
    website TEXT,
    industry VARCHAR(255),
    company_size VARCHAR(100),
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. GeekNews Table (뉴스 피드 테이블)
CREATE TABLE IF NOT EXISTS geeknews (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    url TEXT,
    content TEXT,
    comments TEXT,
    json_ld_raw JSONB,
    markdown TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. GPTERS Table (커뮤니티 포스트 테이블)
CREATE TABLE IF NOT EXISTS gpters (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    url TEXT,
    author VARCHAR(100),
    short_content TEXT,
    published_at VARCHAR(100),
    reactions_count INT DEFAULT 0,
    replies_count INT DEFAULT 0,
    markdown TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. PyTorch KR Table (포럼 게시글 테이블)
CREATE TABLE IF NOT EXISTS pytorch_kr (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    url TEXT,
    published_at VARCHAR(100),
    content TEXT,
    markdown TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
