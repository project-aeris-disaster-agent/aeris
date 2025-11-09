-- Migration: Create Family Finder tables
-- See SPEC.md Section 4.4 for database schema details
-- Created: Phase 1

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy name matching
CREATE EXTENSION IF NOT EXISTS "postgis";  -- For location-based search (optional, install PostGIS if needed)

-- Create missing_persons table
CREATE TABLE IF NOT EXISTS missing_persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_reference VARCHAR(50) UNIQUE NOT NULL,
    
    -- Reporter Information
    reporter_telegram_id BIGINT NOT NULL,
    reporter_name VARCHAR(255),
    reporter_contact VARCHAR(255),
    reporter_relationship VARCHAR(100),
    
    -- Missing Person Information
    missing_person_name VARCHAR(255) NOT NULL,
    missing_person_age INTEGER,
    missing_person_dob DATE,
    missing_person_gender VARCHAR(50),
    
    -- Location Information
    last_known_address TEXT,
    last_known_location_lat DECIMAL(10, 8),
    last_known_location_lng DECIMAL(11, 8),
    last_seen_date TIMESTAMP,
    
    -- Physical Description
    height_cm INTEGER,
    weight_kg INTEGER,
    physical_description TEXT,
    distinguishing_features TEXT,
    clothing_description TEXT,
    
    -- Additional Information
    medical_conditions TEXT,
    special_needs TEXT,
    additional_family_missing TEXT,
    notes TEXT,
    
    -- Status and Metadata
    status VARCHAR(50) DEFAULT 'active', -- active, found, archived, resolved
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    
    -- Privacy and Security
    contact_shared BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE
);

-- Create indexes for search performance
CREATE INDEX IF NOT EXISTS idx_missing_person_name ON missing_persons(missing_person_name);
CREATE INDEX IF NOT EXISTS idx_last_seen_date ON missing_persons(last_seen_date);
CREATE INDEX IF NOT EXISTS idx_status ON missing_persons(status);
CREATE INDEX IF NOT EXISTS idx_location ON missing_persons(last_known_location_lat, last_known_location_lng);
CREATE INDEX IF NOT EXISTS idx_case_reference ON missing_persons(case_reference);
CREATE INDEX IF NOT EXISTS idx_reporter_telegram_id ON missing_persons(reporter_telegram_id);

-- Create family_finder_matches table
CREATE TABLE IF NOT EXISTS family_finder_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id_1 UUID REFERENCES missing_persons(id) ON DELETE CASCADE,
    case_id_2 UUID REFERENCES missing_persons(id) ON DELETE CASCADE,
    match_score DECIMAL(5, 2),
    match_reason TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, notified, contacted, confirmed, rejected
    created_at TIMESTAMP DEFAULT NOW(),
    notified_at TIMESTAMP,
    confirmed_at TIMESTAMP
);

-- Create indexes for matches
CREATE INDEX IF NOT EXISTS idx_matches_case_1 ON family_finder_matches(case_id_1);
CREATE INDEX IF NOT EXISTS idx_matches_case_2 ON family_finder_matches(case_id_2);
CREATE INDEX IF NOT EXISTS idx_matches_status ON family_finder_matches(status);

-- Create family_finder_searches table (for analytics)
CREATE TABLE IF NOT EXISTS family_finder_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    searcher_telegram_id BIGINT NOT NULL,
    search_query TEXT,
    search_criteria JSONB,
    results_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for searches
CREATE INDEX IF NOT EXISTS idx_searches_telegram_id ON family_finder_searches(searcher_telegram_id);
CREATE INDEX IF NOT EXISTS idx_searches_created_at ON family_finder_searches(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_missing_persons_updated_at 
    BEFORE UPDATE ON missing_persons 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to generate case reference
CREATE OR REPLACE FUNCTION generate_case_reference()
RETURNS TEXT AS $$
DECLARE
    ref_prefix TEXT := 'FF-';
    ref_year TEXT := TO_CHAR(NOW(), 'YYYY');
    ref_seq INTEGER;
BEGIN
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(case_reference FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO ref_seq
    FROM missing_persons
    WHERE case_reference LIKE ref_prefix || ref_year || '-%';
    
    -- Format: FF-YYYY-XXXXXX (6 digits)
    RETURN ref_prefix || ref_year || '-' || LPAD(ref_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

