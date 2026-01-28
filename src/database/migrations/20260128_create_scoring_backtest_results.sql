/**
 * Scoring Backtest Results Table
 *
 * Stores backtest performance metrics for each market
 * Used to validate scoring algorithm before production deployment
 *
 * @version 1.0.0
 * @date 2026-01-28
 */

-- Drop existing table if exists (for development only)
DROP TABLE IF EXISTS scoring_backtest_results CASCADE;

-- Create scoring_backtest_results table
CREATE TABLE scoring_backtest_results (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Backtest metadata
  market_id VARCHAR(20) NOT NULL,                   -- O25, BTTS, etc.
  backtest_period VARCHAR(50) NOT NULL,             -- e.g., "2024-01-01 to 2024-12-31"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Raw counts
  total_predictions INTEGER NOT NULL,
  total_settled INTEGER NOT NULL,
  won INTEGER NOT NULL,
  lost INTEGER NOT NULL,
  void INTEGER NOT NULL,

  -- Performance metrics
  hit_rate DECIMAL(5,4) NOT NULL,                   -- Won / Settled (e.g., 0.6150 = 61.5%)
  roi DECIMAL(6,4) NOT NULL,                        -- Return on investment (e.g., 0.0834 = 8.34%)
  avg_odds DECIMAL(6,2),
  avg_confidence DECIMAL(5,2) NOT NULL,             -- Average confidence score
  avg_probability DECIMAL(5,4) NOT NULL,            -- Average predicted probability

  -- Calibration metrics
  calibration_error DECIMAL(5,4) NOT NULL,          -- Overall calibration error
  calibration_curve JSONB NOT NULL,                 -- Bucketed calibration data

  -- Validation status
  validation_passed BOOLEAN NOT NULL,
  validation_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_backtest UNIQUE (market_id, start_date, end_date)
);

-- Indexes
CREATE INDEX idx_backtest_results_market_id ON scoring_backtest_results(market_id);
CREATE INDEX idx_backtest_results_created_at ON scoring_backtest_results(created_at DESC);
CREATE INDEX idx_backtest_results_validation ON scoring_backtest_results(validation_passed);

-- GIN index for JSONB calibration curve
CREATE INDEX idx_backtest_results_calibration ON scoring_backtest_results USING GIN(calibration_curve);

-- Comments for documentation
COMMENT ON TABLE scoring_backtest_results IS 'Stores backtest performance metrics for market validation';
COMMENT ON COLUMN scoring_backtest_results.market_id IS 'Market identifier (O25, BTTS, etc.)';
COMMENT ON COLUMN scoring_backtest_results.backtest_period IS 'Human-readable date range';
COMMENT ON COLUMN scoring_backtest_results.hit_rate IS 'Win rate: Won / Settled (0.0000 - 1.0000)';
COMMENT ON COLUMN scoring_backtest_results.roi IS 'Return on investment: (Returns - Stake) / Stake';
COMMENT ON COLUMN scoring_backtest_results.calibration_error IS 'Overall calibration error (lower is better)';
COMMENT ON COLUMN scoring_backtest_results.calibration_curve IS 'Bucketed calibration data (10% intervals)';
COMMENT ON COLUMN scoring_backtest_results.validation_passed IS 'Whether backtest met minimum thresholds';

-- Sample calibration_curve JSONB structure
COMMENT ON COLUMN scoring_backtest_results.calibration_curve IS 'Example: [{"bucket": "60-70%", "avg_predicted": 0.65, "actual_rate": 0.68, "count": 45, "error": 0.03}]';

-- Function to calculate backtest validation
CREATE OR REPLACE FUNCTION validate_backtest_result(
  p_market_id VARCHAR(20),
  p_hit_rate DECIMAL,
  p_roi DECIMAL,
  p_calibration_error DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  v_min_hit_rate DECIMAL;
  v_min_roi DECIMAL;
  v_max_calibration_error DECIMAL;
BEGIN
  -- Get thresholds from market registry (hardcoded for now)
  CASE p_market_id
    WHEN 'O25', 'BTTS', 'HT_O05', 'HOME_O15' THEN
      v_min_hit_rate := 0.58;
      v_min_roi := 0.05;
      v_max_calibration_error := 0.08;
    WHEN 'O35', 'CORNERS_O85' THEN
      v_min_hit_rate := 0.55;
      v_min_roi := 0.03;
      v_max_calibration_error := 0.12;
    WHEN 'CARDS_O25' THEN
      v_min_hit_rate := 0.52;
      v_min_roi := 0.03;
      v_max_calibration_error := 0.15;
    ELSE
      v_min_hit_rate := 0.50;
      v_min_roi := 0.00;
      v_max_calibration_error := 0.20;
  END CASE;

  -- Check if all thresholds are met
  RETURN (
    p_hit_rate >= v_min_hit_rate AND
    p_roi >= v_min_roi AND
    p_calibration_error <= v_max_calibration_error
  );
END;
$$ LANGUAGE plpgsql;

-- View for latest backtest results
CREATE OR REPLACE VIEW v_latest_backtest_results AS
SELECT DISTINCT ON (market_id)
  id,
  market_id,
  backtest_period,
  hit_rate,
  roi,
  calibration_error,
  validation_passed,
  created_at
FROM scoring_backtest_results
ORDER BY market_id, created_at DESC;

COMMENT ON VIEW v_latest_backtest_results IS 'Shows the latest backtest result for each market';

-- Grant permissions (adjust based on your user)
-- GRANT SELECT, INSERT ON scoring_backtest_results TO goalgpt_api;
-- GRANT SELECT ON v_latest_backtest_results TO goalgpt_api;

-- Success message
SELECT 'scoring_backtest_results table created successfully' AS status;
