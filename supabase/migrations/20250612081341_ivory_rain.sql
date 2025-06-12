/*
  # Daily Suspicion Analytics

  1. Views and Functions
    - `v_daily_suspicion` - Aggregated daily suspicion view
    - `get_suspicion_trends()` - Function to get trends with date filling
    - `get_live_dashboard_stats()` - Real-time dashboard KPIs
    
  2. Security
    - Grant appropriate permissions to authenticated users
    - Functions are security definer for consistent access
    
  3. Real-time Strategy
    - Use functions for real-time data (not views in publications)
    - Views for efficient querying
    - Triggers for cache invalidation if needed
*/

-- Create the daily suspicion aggregated view
CREATE OR REPLACE VIEW v_daily_suspicion AS
SELECT 
  date_trunc('day', created_at) AS bucket,
  round(100.0 * avg((suspicion_level >= 80)::int), 2) AS rate,
  count(*) AS volume
FROM scores
GROUP BY date_trunc('day', created_at)
ORDER BY bucket DESC;

-- Grant permissions for the view
GRANT SELECT ON v_daily_suspicion TO authenticated;
GRANT SELECT ON v_daily_suspicion TO service_role;
GRANT SELECT ON v_daily_suspicion TO anon;

-- Create a function to get suspicion trends for the last N days
CREATE OR REPLACE FUNCTION get_suspicion_trends(days_back integer DEFAULT 30)
RETURNS TABLE (
  date text,
  suspicion_rate numeric,
  volume bigint
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH date_series AS (
    SELECT generate_series(
      current_date - (days_back - 1),
      current_date,
      '1 day'::interval
    )::date AS date
  ),
  daily_stats AS (
    SELECT 
      date_trunc('day', created_at)::date AS date,
      round(100.0 * avg((suspicion_level >= 80)::int), 2) AS suspicion_rate,
      count(*) AS volume
    FROM scores
    WHERE created_at >= current_date - days_back
    GROUP BY date_trunc('day', created_at)::date
  )
  SELECT 
    ds.date::text,
    COALESCE(dst.suspicion_rate, 0) AS suspicion_rate,
    COALESCE(dst.volume, 0) AS volume
  FROM date_series ds
  LEFT JOIN daily_stats dst ON ds.date = dst.date
  ORDER BY ds.date;
$$;

-- Create function for real-time dashboard KPIs
CREATE OR REPLACE FUNCTION get_live_dashboard_stats()
RETURNS TABLE (
  games_24h bigint,
  suspect_pct numeric,
  avg_elo numeric,
  active_players bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    count(*) FILTER (WHERE s.created_at >= now() - interval '24 hour') AS games_24h,
    round(100.0 * count(*) FILTER (WHERE s.suspicion_level >= 80) 
          / greatest(count(*), 1), 1) AS suspect_pct,
    round(avg(p.elo) FILTER (WHERE g.date >= current_date - 1), 0) AS avg_elo,
    count(DISTINCT p.id) FILTER (WHERE s.created_at >= now() - interval '24 hour') AS active_players
  FROM scores s
  JOIN games g ON g.id = s.game_id
  JOIN players p ON p.id = g.player_id;
$$;

-- Create function to get recent high-risk games
CREATE OR REPLACE FUNCTION get_recent_high_risk_games(limit_count integer DEFAULT 20)
RETURNS TABLE (
  score_id uuid,
  game_id uuid,
  player_hash text,
  site text,
  elo integer,
  suspicion_level integer,
  match_engine_pct numeric,
  ml_prob numeric,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    s.id as score_id,
    s.game_id,
    p.hash as player_hash,
    g.site,
    p.elo,
    s.suspicion_level,
    s.match_engine_pct,
    s.ml_prob,
    s.created_at
  FROM scores s
  JOIN games g ON g.id = s.game_id
  JOIN players p ON p.id = g.player_id
  WHERE s.suspicion_level >= 70
  ORDER BY s.created_at DESC
  LIMIT limit_count;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_suspicion_trends(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_suspicion_trends(integer) TO service_role;
GRANT EXECUTE ON FUNCTION get_live_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_live_dashboard_stats() TO service_role;
GRANT EXECUTE ON FUNCTION get_recent_high_risk_games(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_high_risk_games(integer) TO service_role;

-- Create a trigger function for real-time notifications
CREATE OR REPLACE FUNCTION notify_score_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify about new high-risk scores for real-time updates
  IF NEW.suspicion_level >= 70 THEN
    PERFORM pg_notify('high_risk_score', json_build_object(
      'score_id', NEW.id,
      'game_id', NEW.game_id,
      'suspicion_level', NEW.suspicion_level,
      'created_at', NEW.created_at
    )::text);
  END IF;
  
  -- Notify about daily stats changes
  PERFORM pg_notify('daily_stats_update', json_build_object(
    'date', date_trunc('day', NEW.created_at),
    'action', 'INSERT'
  )::text);
  
  RETURN NEW;
END;
$$;

-- Create trigger for real-time notifications
DROP TRIGGER IF EXISTS trigger_notify_score_changes ON scores;
CREATE TRIGGER trigger_notify_score_changes
  AFTER INSERT ON scores
  FOR EACH ROW
  EXECUTE FUNCTION notify_score_changes();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scores_created_at_day ON scores (date_trunc('day', created_at));
CREATE INDEX IF NOT EXISTS idx_scores_suspicion_created ON scores (suspicion_level, created_at) WHERE suspicion_level >= 70;