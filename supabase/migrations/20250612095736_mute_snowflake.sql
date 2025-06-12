/*
  # Scheduler Infrastructure Migration

  1. Database Maintenance Functions
    - `execute_maintenance_query()` - Safe VACUUM/ANALYZE/REINDEX operations
    - `get_table_statistics()` - Table size and performance stats
    - `execute_query()` - Secure dynamic SELECT queries

  2. Scheduler Tables
    - `scheduler_jobs` - Track job executions with status, metrics, and errors
    - `scheduler_metrics` - Store performance metrics with labels and timestamps

  3. Security
    - RLS enabled on all new tables
    - Service role permissions for admin functions
    - Authenticated user read access where appropriate

  4. Monitoring
    - Dashboard view for aggregated scheduler statistics
    - Notification triggers for job completion events
    - Automatic cleanup of old metrics
*/

-- 1. Create function to execute maintenance queries
CREATE OR REPLACE FUNCTION execute_maintenance_query(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow specific maintenance operations
  IF query ~* '^(VACUUM|ANALYZE|REINDEX)' THEN
    EXECUTE query;
  ELSE
    RAISE EXCEPTION 'Only VACUUM, ANALYZE, and REINDEX operations are allowed';
  END IF;
END;
$$;

-- Grant permissions to service role only
GRANT EXECUTE ON FUNCTION execute_maintenance_query(text) TO service_role;

-- 2. Create function to get table statistics
CREATE OR REPLACE FUNCTION get_table_statistics()
RETURNS TABLE (
  table_name text,
  row_count bigint,
  table_size text,
  index_size text,
  total_size text,
  last_vacuum timestamptz,
  last_analyze timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    schemaname||'.'||relname as table_name,
    n_tup_ins + n_tup_upd - n_tup_del as row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||relname)) as index_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname) + pg_indexes_size(schemaname||'.'||relname)) as total_size,
    last_vacuum,
    last_analyze
  FROM pg_stat_user_tables 
  WHERE schemaname = 'public'
    AND relname IN ('players', 'games', 'scores', 'sync_cursor')
  ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_table_statistics() TO service_role;
GRANT EXECUTE ON FUNCTION get_table_statistics() TO authenticated;

-- 3. Create function to execute dynamic queries (for scheduler targets)
CREATE OR REPLACE FUNCTION execute_query(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Security check: only allow SELECT queries on specific tables
  IF NOT (query ~* '^SELECT.*FROM\s+(sync_cursor|players|games|scores)') THEN
    RAISE EXCEPTION 'Only SELECT queries on allowed tables are permitted';
  END IF;
  
  -- Prevent potentially dangerous operations
  IF query ~* '(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Grant permissions to service role only
GRANT EXECUTE ON FUNCTION execute_query(text) TO service_role;

-- 4. Create scheduler jobs tracking table
CREATE TABLE IF NOT EXISTS scheduler_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  targets_processed integer DEFAULT 0,
  targets_total integer DEFAULT 0,
  games_imported integer DEFAULT 0,
  errors text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'scheduler_jobs' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE scheduler_jobs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies (drop existing ones first to avoid conflicts)
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Service role can manage scheduler jobs" ON scheduler_jobs;
  DROP POLICY IF EXISTS "Authenticated users can read scheduler jobs" ON scheduler_jobs;
  
  -- Create new policies
  CREATE POLICY "Service role can manage scheduler jobs"
    ON scheduler_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

  CREATE POLICY "Authenticated users can read scheduler jobs"
    ON scheduler_jobs
    FOR SELECT
    TO authenticated
    USING (true);
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_name_status ON scheduler_jobs(job_name, status);
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_started_at ON scheduler_jobs(started_at DESC);

-- 5. Create scheduler metrics table
CREATE TABLE IF NOT EXISTS scheduler_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_type text NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
  value numeric NOT NULL,
  labels jsonb DEFAULT '{}',
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'scheduler_metrics' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE scheduler_metrics ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies (drop existing ones first to avoid conflicts)
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Service role can manage scheduler metrics" ON scheduler_metrics;
  DROP POLICY IF EXISTS "Authenticated users can read scheduler metrics" ON scheduler_metrics;
  
  -- Create new policies
  CREATE POLICY "Service role can manage scheduler metrics"
    ON scheduler_metrics
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

  CREATE POLICY "Authenticated users can read scheduler metrics"
    ON scheduler_metrics
    FOR SELECT
    TO authenticated
    USING (true);
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduler_metrics_name_timestamp ON scheduler_metrics(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scheduler_metrics_timestamp ON scheduler_metrics(timestamp DESC);

-- 6. Create function to record scheduler metrics
CREATE OR REPLACE FUNCTION record_scheduler_metric(
  p_metric_name text,
  p_metric_type text,
  p_value numeric,
  p_labels jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO scheduler_metrics (metric_name, metric_type, value, labels)
  VALUES (p_metric_name, p_metric_type, p_value, p_labels);
  
  -- Clean up old metrics (keep last 30 days)
  DELETE FROM scheduler_metrics 
  WHERE timestamp < now() - interval '30 days';
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION record_scheduler_metric(text, text, numeric, jsonb) TO service_role;

-- 7. Create view for scheduler dashboard
CREATE OR REPLACE VIEW v_scheduler_dashboard AS
SELECT 
  -- Job statistics
  (SELECT COUNT(*) FROM scheduler_jobs WHERE status = 'running') as active_jobs,
  (SELECT COUNT(*) FROM scheduler_jobs WHERE started_at > now() - interval '24 hours') as jobs_24h,
  (SELECT COUNT(*) FROM scheduler_jobs WHERE status = 'completed' AND started_at > now() - interval '24 hours') as successful_jobs_24h,
  (SELECT COUNT(*) FROM scheduler_jobs WHERE status = 'failed' AND started_at > now() - interval '24 hours') as failed_jobs_24h,
  (SELECT SUM(games_imported) FROM scheduler_jobs WHERE started_at > now() - interval '24 hours') as games_imported_24h,
  
  -- Recent job executions
  (
    SELECT json_agg(
      json_build_object(
        'job_name', job_name,
        'status', status,
        'started_at', started_at,
        'completed_at', completed_at,
        'games_imported', games_imported,
        'duration_seconds', EXTRACT(EPOCH FROM (COALESCE(completed_at, now()) - started_at))
      ) ORDER BY started_at DESC
    )
    FROM scheduler_jobs 
    WHERE started_at > now() - interval '7 days'
    LIMIT 20
  ) as recent_jobs,
  
  -- System health
  now() as last_updated;

-- Grant permissions on view
GRANT SELECT ON v_scheduler_dashboard TO authenticated;
GRANT SELECT ON v_scheduler_dashboard TO service_role;

-- 8. Create function to get scheduler status
CREATE OR REPLACE FUNCTION get_scheduler_status()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT row_to_json(v_scheduler_dashboard) FROM v_scheduler_dashboard;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_scheduler_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_scheduler_status() TO service_role;

-- 9. Create notification function for scheduler events
CREATE OR REPLACE FUNCTION notify_scheduler_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify on job completion or failure
  IF (TG_OP = 'UPDATE' AND OLD.status = 'running' AND NEW.status IN ('completed', 'failed')) THEN
    PERFORM pg_notify(
      'scheduler_job_completed',
      json_build_object(
        'job_name', NEW.job_name,
        'status', NEW.status,
        'games_imported', NEW.games_imported,
        'duration_seconds', EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)),
        'errors_count', array_length(NEW.errors, 1)
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for scheduler notifications (drop existing first)
DROP TRIGGER IF EXISTS trigger_scheduler_notifications ON scheduler_jobs;
CREATE TRIGGER trigger_scheduler_notifications
  AFTER UPDATE ON scheduler_jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_scheduler_event();

-- 10. Add comments for documentation
COMMENT ON TABLE scheduler_jobs IS 'Tracks execution of scheduled import jobs';
COMMENT ON TABLE scheduler_metrics IS 'Stores scheduler performance metrics';
COMMENT ON FUNCTION execute_maintenance_query(text) IS 'Execute database maintenance queries (VACUUM, ANALYZE, REINDEX)';
COMMENT ON FUNCTION get_table_statistics() IS 'Get statistics for main database tables';
COMMENT ON FUNCTION execute_query(text) IS 'Execute dynamic SELECT queries for scheduler targets';
COMMENT ON FUNCTION record_scheduler_metric(text, text, numeric, jsonb) IS 'Record scheduler performance metrics';
COMMENT ON VIEW v_scheduler_dashboard IS 'Dashboard view for scheduler status and metrics';