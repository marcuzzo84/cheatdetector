/*
  # Database Hardening for Chess API Integration

  1. Games Table Enhancement
    - Add `ext_uid` column to track external game IDs from Chess.com and Lichess
    - Create unique index to prevent duplicate imports
    - Add constraint to ensure ext_uid is provided for new games

  2. Sync Cursor Table
    - Track import progress for each site/username combination
    - Enable resumable imports by storing last imported timestamp
    - Prevent duplicate work and enable incremental syncs

  3. Data Integrity
    - Ensure no duplicate games are imported
    - Track import metadata for debugging and monitoring
    - Enable efficient incremental updates
*/

-- 1. Add external UID column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS ext_uid text;

-- Create unique index to prevent duplicate imports
CREATE UNIQUE INDEX IF NOT EXISTS games_site_ext_uid_idx
  ON games(site, ext_uid)
  WHERE ext_uid IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN games.ext_uid IS 'External game ID from Chess.com or Lichess API';

-- 2. Create sync cursor table for resumable imports
CREATE TABLE IF NOT EXISTS sync_cursor (
  site text NOT NULL,
  username text NOT NULL,
  last_ts timestamptz NOT NULL DEFAULT now(),
  last_game_id text,
  total_imported integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (site, username)
);

-- Enable RLS on sync_cursor
ALTER TABLE sync_cursor ENABLE ROW LEVEL SECURITY;

-- Create policies for sync_cursor
CREATE POLICY "Service role can manage sync cursors"
  ON sync_cursor
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read sync cursors"
  ON sync_cursor
  FOR SELECT
  TO authenticated
  USING (true);

-- Add comments for documentation
COMMENT ON TABLE sync_cursor IS 'Tracks import progress for resumable chess game imports';
COMMENT ON COLUMN sync_cursor.site IS 'Chess platform: Chess.com or Lichess';
COMMENT ON COLUMN sync_cursor.username IS 'Player username on the platform';
COMMENT ON COLUMN sync_cursor.last_ts IS 'Timestamp of the newest game already imported';
COMMENT ON COLUMN sync_cursor.last_game_id IS 'External ID of the last imported game';
COMMENT ON COLUMN sync_cursor.total_imported IS 'Total number of games imported for this user';

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_sync_cursor_updated_at
  BEFORE UPDATE ON sync_cursor
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. Create function to get import status
CREATE OR REPLACE FUNCTION get_import_status(p_site text DEFAULT NULL, p_username text DEFAULT NULL)
RETURNS TABLE (
  site text,
  username text,
  last_import timestamptz,
  total_games integer,
  last_game_date timestamptz,
  can_resume boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    sc.site,
    sc.username,
    sc.last_ts as last_import,
    sc.total_imported as total_games,
    sc.last_ts as last_game_date,
    (sc.last_ts < now() - interval '1 day') as can_resume
  FROM sync_cursor sc
  WHERE (p_site IS NULL OR sc.site = p_site)
    AND (p_username IS NULL OR sc.username = p_username)
  ORDER BY sc.updated_at DESC;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_import_status(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_import_status(text, text) TO service_role;

-- 4. Create function to update sync cursor
CREATE OR REPLACE FUNCTION update_sync_cursor(
  p_site text,
  p_username text,
  p_last_ts timestamptz,
  p_last_game_id text DEFAULT NULL,
  p_increment_count integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO sync_cursor (site, username, last_ts, last_game_id, total_imported)
  VALUES (p_site, p_username, p_last_ts, p_last_game_id, p_increment_count)
  ON CONFLICT (site, username)
  DO UPDATE SET
    last_ts = GREATEST(sync_cursor.last_ts, p_last_ts),
    last_game_id = COALESCE(p_last_game_id, sync_cursor.last_game_id),
    total_imported = sync_cursor.total_imported + p_increment_count,
    updated_at = now();
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_sync_cursor(text, text, timestamptz, text, integer) TO service_role;

-- 5. Create function to check for duplicate games
CREATE OR REPLACE FUNCTION game_exists(p_site text, p_ext_uid text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM games 
    WHERE site = p_site AND ext_uid = p_ext_uid
  );
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION game_exists(text, text) TO service_role;

-- 6. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_site_date ON games(site, date DESC);
CREATE INDEX IF NOT EXISTS idx_games_ext_uid ON games(ext_uid) WHERE ext_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sync_cursor_updated_at ON sync_cursor(updated_at DESC);

-- 7. Create view for import statistics
CREATE OR REPLACE VIEW v_import_stats AS
SELECT 
  sc.site,
  COUNT(DISTINCT sc.username) as unique_players,
  SUM(sc.total_imported) as total_games_imported,
  MAX(sc.last_ts) as most_recent_import,
  MIN(sc.created_at) as first_import,
  COUNT(*) as import_sessions
FROM sync_cursor sc
GROUP BY sc.site
UNION ALL
SELECT 
  'TOTAL' as site,
  COUNT(DISTINCT sc.username) as unique_players,
  SUM(sc.total_imported) as total_games_imported,
  MAX(sc.last_ts) as most_recent_import,
  MIN(sc.created_at) as first_import,
  COUNT(*) as import_sessions
FROM sync_cursor sc;

-- Grant permissions on view
GRANT SELECT ON v_import_stats TO authenticated;
GRANT SELECT ON v_import_stats TO service_role;

-- 8. Create function to clean up old sync cursors (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_sync_cursors(days_old integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM sync_cursor 
  WHERE updated_at < now() - (days_old || ' days')::interval
    AND total_imported = 0;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_old_sync_cursors(integer) TO service_role;

-- 9. Add constraint to ensure ext_uid is provided for new games (optional)
-- Uncomment the following line if you want to enforce ext_uid for all new games
-- ALTER TABLE games ADD CONSTRAINT games_ext_uid_required CHECK (ext_uid IS NOT NULL);

-- 10. Create notification function for import completion
CREATE OR REPLACE FUNCTION notify_import_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify when a significant import batch is completed (>10 games)
  IF NEW.total_imported - COALESCE(OLD.total_imported, 0) >= 10 THEN
    PERFORM pg_notify(
      'import_completed',
      json_build_object(
        'site', NEW.site,
        'username', NEW.username,
        'games_imported', NEW.total_imported - COALESCE(OLD.total_imported, 0),
        'total_games', NEW.total_imported
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for import notifications
DROP TRIGGER IF EXISTS trigger_import_completion ON sync_cursor;
CREATE TRIGGER trigger_import_completion
  AFTER INSERT OR UPDATE ON sync_cursor
  FOR EACH ROW
  EXECUTE FUNCTION notify_import_completion();