-- ============================================================================
-- FOOTYSTATS SYNC ANOMALIES SCHEMA
-- ============================================================================
-- Purpose: Track data quality issues and API mismatches
--
-- Use Cases:
--   1. Competition mismatch: API returns wrong teams for a league
--   2. Season mismatch: API returns different season than requested
--   3. Duplicate teams: Same team appears in multiple competitions
--   4. Missing data: Expected data not returned by API
-- ============================================================================

CREATE TABLE IF NOT EXISTS fs_sync_anomalies (
  id BIGSERIAL PRIMARY KEY,

  -- Anomaly metadata
  job_name TEXT NOT NULL,                    -- e.g., 'teams_catalog_sync'
  anomaly_type TEXT NOT NULL,                -- e.g., 'competition_mismatch'
  severity TEXT NOT NULL DEFAULT 'warning',  -- 'info', 'warning', 'error', 'critical'

  -- Entity identification
  entity_type TEXT,                          -- e.g., 'team', 'competition', 'match'
  entity_id TEXT,                            -- e.g., 'team:206', 'competition:22'

  -- Context
  expected_value TEXT,                       -- What we expected
  actual_value TEXT,                         -- What API returned
  details JSONB,                             -- Additional context

  -- Resolution
  action_taken TEXT,                         -- e.g., 'rejected', 'quarantined', 'accepted'
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Timestamps
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  CONSTRAINT chk_severity CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_fs_sync_anomalies_job
  ON fs_sync_anomalies (job_name);

CREATE INDEX IF NOT EXISTS idx_fs_sync_anomalies_type
  ON fs_sync_anomalies (anomaly_type);

CREATE INDEX IF NOT EXISTS idx_fs_sync_anomalies_severity
  ON fs_sync_anomalies (severity);

CREATE INDEX IF NOT EXISTS idx_fs_sync_anomalies_resolved
  ON fs_sync_anomalies (resolved) WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_fs_sync_anomalies_detected
  ON fs_sync_anomalies (detected_at DESC);

COMMENT ON TABLE fs_sync_anomalies IS 'Tracks data quality issues and API mismatches during sync operations';
COMMENT ON COLUMN fs_sync_anomalies.anomaly_type IS 'Type of anomaly: competition_mismatch, season_mismatch, duplicate_team, missing_data';
COMMENT ON COLUMN fs_sync_anomalies.action_taken IS 'Action taken: rejected (not written to DB), quarantined, accepted (written with flag)';

-- ============================================================================
-- HELPER FUNCTION: Log anomaly
-- ============================================================================
CREATE OR REPLACE FUNCTION log_sync_anomaly(
  p_job_name TEXT,
  p_anomaly_type TEXT,
  p_severity TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_expected_value TEXT DEFAULT NULL,
  p_actual_value TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_action_taken TEXT DEFAULT 'rejected'
) RETURNS BIGINT AS $$
  INSERT INTO fs_sync_anomalies (
    job_name,
    anomaly_type,
    severity,
    entity_type,
    entity_id,
    expected_value,
    actual_value,
    details,
    action_taken
  ) VALUES (
    p_job_name,
    p_anomaly_type,
    p_severity,
    p_entity_type,
    p_entity_id,
    p_expected_value,
    p_actual_value,
    p_details,
    p_action_taken
  )
  RETURNING id;
$$ LANGUAGE SQL;

-- ============================================================================
-- VIEW: Unresolved anomalies summary
-- ============================================================================
CREATE OR REPLACE VIEW v_unresolved_anomalies AS
SELECT
  job_name,
  anomaly_type,
  severity,
  COUNT(*) as count,
  MIN(detected_at) as first_detected,
  MAX(detected_at) as last_detected
FROM fs_sync_anomalies
WHERE resolved = FALSE
GROUP BY job_name, anomaly_type, severity
ORDER BY severity DESC, count DESC;

COMMENT ON VIEW v_unresolved_anomalies IS 'Summary of unresolved anomalies by job, type, and severity';
