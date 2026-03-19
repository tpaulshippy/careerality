-- State Employment Projections table
-- Source: Projections Central (https://projectionscentral.org)
-- License: Public Domain (US Department of Labor)

CREATE TABLE IF NOT EXISTS state_employment_projections (
    id SERIAL PRIMARY KEY,
    state_fips VARCHAR(2) NOT NULL,
    state_abbr VARCHAR(2) NOT NULL,
    occ_code VARCHAR(10),
    occupation_title VARCHAR(255),
    base_employment INTEGER,
    projected_employment INTEGER,
    employment_change INTEGER,
    percent_change NUMERIC(10,2),
    avg_annual_openings INTEGER,
    base_year INTEGER,
    proj_year INTEGER,
    projection_type VARCHAR(20),  -- 'long_term' or 'short_term'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(state_fips, occ_code, projection_type)
);

CREATE INDEX IF NOT EXISTS idx_projections_state ON state_employment_projections(state_fips);
CREATE INDEX IF NOT EXISTS idx_projections_occ_code ON state_employment_projections(occ_code);
CREATE INDEX IF NOT EXISTS idx_projections_type ON state_employment_projections(projection_type);

-- Table to store high-demand careers per state
-- This is derived from the state_employment_projections table
CREATE TABLE IF NOT EXISTS state_high_demand_careers (
    id SERIAL PRIMARY KEY,
    state_fips VARCHAR(2) NOT NULL,
    state_abbr VARCHAR(2) NOT NULL,
    occ_code VARCHAR(10) NOT NULL,
    occupation_title VARCHAR(255),
    rank INTEGER,  -- Rank by demand (1 = highest)
    demand_metric VARCHAR(50),  -- e.g., 'percent_change', 'avg_annual_openings', 'total_growth'
    demand_value NUMERIC,
    base_employment INTEGER,
    projected_employment INTEGER,
    employment_change INTEGER,
    percent_change NUMERIC(10,2),
    avg_annual_openings INTEGER,
    projection_type VARCHAR(20),
    base_year INTEGER,
    proj_year INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(state_fips, occ_code, projection_type, demand_metric)
);

CREATE INDEX IF NOT EXISTS idx_high_demand_state ON state_high_demand_careers(state_fips, state_abbr);
CREATE INDEX IF NOT EXISTS idx_high_demand_occ ON state_high_demand_careers(occ_code);
