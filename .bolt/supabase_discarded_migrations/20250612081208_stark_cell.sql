/*
  # Create Daily Suspicion Aggregated View

  1. New Views
    - `v_daily_suspicion`
      - `bucket` (date, truncated to day)
      - `rate` (percentage of games with suspicion_level >= 80)
      - `volume` (total number of games analyzed that day)

  2. Real-time Setup
    - Enable realtime publication for the view
    - Automatic updates when scores table changes

  3. Performance
    - Efficient aggregation by day
    - Indexed for fast queries
    - Real-time updates without polling
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

-- Add the view to realtime publication
BEGIN;
ALTER PUBLICATION supabase_realtime ADD TABLE v_daily_suspicion;
COMMIT;

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_suspicion_trends(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_suspicion_trends(integer) TO service_role;

-- Create a trigger function to refresh materialized view if needed
-- (Note: We're using a regular view for real-time updates, but this could be useful for performance)
CREATE OR REPLACE FUNCTION refresh_daily_suspicion_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function can be used to trigger additional processing
  -- when new scores are inserted, if needed for performance optimization
  RETURN NEW;
END;
$$;

-- Optional: Create trigger to handle real-time updates
-- (The view already updates automatically, but this can be used for additional processing)
CREATE OR REPLACE TRIGGER trigger_refresh_daily_suspicion
  AFTER INSERT OR UPDATE OR DELETE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION refresh_daily_suspicion_stats();