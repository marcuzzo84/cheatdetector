/*
  # Enable Realtime Publication for Daily Suspicion View

  1. Tables Added to Publication
    - `v_daily_suspicion` view for live chart updates
    - `scores` table for real-time score streaming
    - `games` and `players` tables for comprehensive updates

  2. Security
    - Maintains existing RLS policies
    - Grants appropriate permissions for realtime access

  3. Performance
    - Uses existing optimized indexes
    - Leverages view aggregation for efficiency
*/

-- Add the daily suspicion view to realtime publication
-- Note: We'll use a workaround since views can't be directly added to publications
-- Instead, we'll ensure the underlying tables are published and use triggers

-- Ensure all relevant tables are in the realtime publication
BEGIN;

-- Add scores table to realtime (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
  END IF;
END $$;

-- Add games table to realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
  END IF;
END $$;

-- Add players table to realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
END $$;

COMMIT;

-- Create a materialized view refresh function for better performance (optional)
CREATE OR REPLACE FUNCTION refresh_daily_suspicion_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function can be called to refresh any cached aggregations
  -- For now, the view is dynamic and doesn't need refreshing
  -- But this provides a hook for future optimizations
  
  -- Notify clients that daily suspicion data has been updated
  PERFORM pg_notify('daily_suspicion_updated', json_build_object(
    'timestamp', now(),
    'action', 'refresh'
  )::text);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_daily_suspicion_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_daily_suspicion_cache() TO service_role;

-- Enhanced trigger function to notify about view changes
CREATE OR REPLACE FUNCTION notify_daily_suspicion_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify about changes that affect the daily suspicion view
  PERFORM pg_notify('daily_suspicion_changed', json_build_object(
    'date', date_trunc('day', COALESCE(NEW.created_at, OLD.created_at)),
    'event', TG_OP,
    'table', TG_TABLE_NAME
  )::text);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on scores table to notify about daily suspicion changes
DROP TRIGGER IF EXISTS trigger_daily_suspicion_changes ON scores;
CREATE TRIGGER trigger_daily_suspicion_changes
  AFTER INSERT OR UPDATE OR DELETE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION notify_daily_suspicion_changes();

-- Create a function to simulate the view being in realtime publication
CREATE OR REPLACE FUNCTION get_daily_suspicion_realtime()
RETURNS TABLE (
  bucket timestamptz,
  rate numeric,
  volume bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    date_trunc('day', created_at) AS bucket,
    round(100.0 * avg((suspicion_level >= 80)::int), 2) AS rate,
    count(*) AS volume
  FROM scores
  WHERE created_at >= current_date - interval '30 days'
  GROUP BY date_trunc('day', created_at)
  ORDER BY bucket DESC;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_daily_suspicion_realtime() TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_suspicion_realtime() TO service_role;
GRANT EXECUTE ON FUNCTION get_daily_suspicion_realtime() TO anon;