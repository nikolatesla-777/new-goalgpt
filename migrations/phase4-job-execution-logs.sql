-- Phase 4: Job Execution Logs Table
-- Purpose: Track background job execution history for monitoring and debugging

CREATE TABLE IF NOT EXISTS job_execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    items_processed INT DEFAULT 0,
    error_message TEXT,
    duration_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_job_logs_name ON job_execution_logs(job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_logs_status ON job_execution_logs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_logs_created ON job_execution_logs(created_at DESC);

-- Comments
COMMENT ON TABLE job_execution_logs IS 'Background job execution history for monitoring and debugging';
COMMENT ON COLUMN job_execution_logs.job_name IS 'Name of the background job';
COMMENT ON COLUMN job_execution_logs.started_at IS 'Job start timestamp';
COMMENT ON COLUMN job_execution_logs.completed_at IS 'Job completion timestamp (null if still running)';
COMMENT ON COLUMN job_execution_logs.status IS 'Job status: running, success, or failed';
COMMENT ON COLUMN job_execution_logs.items_processed IS 'Number of items/records processed by the job';
COMMENT ON COLUMN job_execution_logs.error_message IS 'Error message if job failed';
COMMENT ON COLUMN job_execution_logs.duration_ms IS 'Job execution duration in milliseconds';
