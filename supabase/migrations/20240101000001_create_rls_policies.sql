-- Migration: Create Row Level Security (RLS) policies
-- See SPEC.md Section 4.4.2 for RLS details
-- Created: Phase 1

-- Enable RLS on all tables
ALTER TABLE missing_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_finder_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_finder_searches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own missing person reports
CREATE POLICY "Users can view own reports"
    ON missing_persons
    FOR SELECT
    USING (reporter_telegram_id = current_setting('app.telegram_user_id', TRUE)::BIGINT);

-- Policy: Users can insert their own reports
CREATE POLICY "Users can insert own reports"
    ON missing_persons
    FOR INSERT
    WITH CHECK (reporter_telegram_id = current_setting('app.telegram_user_id', TRUE)::BIGINT);

-- Policy: Users can update their own reports
CREATE POLICY "Users can update own reports"
    ON missing_persons
    FOR UPDATE
    USING (reporter_telegram_id = current_setting('app.telegram_user_id', TRUE)::BIGINT);

-- Policy: Users can view matches involving their reports
CREATE POLICY "Users can view own matches"
    ON family_finder_matches
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM missing_persons mp
            WHERE (mp.id = family_finder_matches.case_id_1 OR mp.id = family_finder_matches.case_id_2)
            AND mp.reporter_telegram_id = current_setting('app.telegram_user_id', TRUE)::BIGINT
        )
    );

-- Policy: Users can view their own search history
CREATE POLICY "Users can view own searches"
    ON family_finder_searches
    FOR SELECT
    USING (searcher_telegram_id = current_setting('app.telegram_user_id', TRUE)::BIGINT);

-- Policy: Users can insert their own searches
CREATE POLICY "Users can insert own searches"
    ON family_finder_searches
    FOR INSERT
    WITH CHECK (searcher_telegram_id = current_setting('app.telegram_user_id', TRUE)::BIGINT);

-- Note: Service role key bypasses RLS, so server-side operations will work
-- For client-side operations, set the telegram_user_id before queries:
-- SELECT set_config('app.telegram_user_id', '123456789', false);

