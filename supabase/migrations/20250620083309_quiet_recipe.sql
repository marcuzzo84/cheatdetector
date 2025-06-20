/*
  # Player Management System

  1. New Tables
    - `player_groups` - For organizing players into groups
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `description` (text)
      - `player_count` (integer)
      - `is_public` (boolean)
      - `owner_id` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `tracked_players` - For tracking specific players
      - `id` (uuid, primary key)
      - `player_id` (uuid, references players)
      - `group_id` (uuid, references player_groups)
      - `username` (text, not null)
      - `site` (text, not null)
      - `notes` (text)
      - `auto_import` (boolean)
      - `import_frequency` (text)
      - `last_import` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
    - Add policies for admins to manage all data
    - Add policies for public access to public groups
*/

-- Create player_groups table
CREATE TABLE IF NOT EXISTS player_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  player_count integer DEFAULT 0,
  is_public boolean DEFAULT false,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create tracked_players table
CREATE TABLE IF NOT EXISTS tracked_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  group_id uuid REFERENCES player_groups(id) ON DELETE SET NULL,
  username text NOT NULL,
  site text NOT NULL,
  notes text,
  auto_import boolean DEFAULT false,
  import_frequency text DEFAULT 'daily',
  last_import timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_site CHECK (site IN ('Chess.com', 'Lichess')),
  CONSTRAINT valid_import_frequency CHECK (import_frequency IN ('hourly', 'daily', 'weekly', 'monthly'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_player_groups_owner_id ON player_groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_player_groups_is_public ON player_groups(is_public);
CREATE INDEX IF NOT EXISTS idx_tracked_players_player_id ON tracked_players(player_id);
CREATE INDEX IF NOT EXISTS idx_tracked_players_group_id ON tracked_players(group_id);
CREATE INDEX IF NOT EXISTS idx_tracked_players_site_username ON tracked_players(site, username);
CREATE INDEX IF NOT EXISTS idx_tracked_players_auto_import ON tracked_players(auto_import) WHERE auto_import = true;

-- Enable Row Level Security
ALTER TABLE player_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_players ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for player_groups
-- Owners can manage their own groups
CREATE POLICY "Users can manage their own player groups"
  ON player_groups
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Anyone can view public groups
CREATE POLICY "Anyone can view public player groups"
  ON player_groups
  FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Admins can manage all groups
CREATE POLICY "Admins can manage all player groups"
  ON player_groups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'administrator')
    )
  );

-- Create RLS policies for tracked_players
-- Users can manage their own tracked players
CREATE POLICY "Users can manage their own tracked players"
  ON tracked_players
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_groups
      WHERE player_groups.id = tracked_players.group_id
        AND player_groups.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM player_groups
      WHERE player_groups.id = tracked_players.group_id
        AND player_groups.owner_id = auth.uid()
    )
  );

-- Users can view tracked players in public groups
CREATE POLICY "Users can view tracked players in public groups"
  ON tracked_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_groups
      WHERE player_groups.id = tracked_players.group_id
        AND player_groups.is_public = true
    )
  );

-- Admins can manage all tracked players
CREATE POLICY "Admins can manage all tracked players"
  ON tracked_players
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'administrator')
    )
  );

-- Create trigger function to update player_count in player_groups
CREATE OR REPLACE FUNCTION update_player_group_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE player_groups
    SET player_count = player_count + 1,
        updated_at = now()
    WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE player_groups
    SET player_count = player_count - 1,
        updated_at = now()
    WHERE id = OLD.group_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.group_id <> OLD.group_id THEN
    -- Decrement count in old group
    UPDATE player_groups
    SET player_count = player_count - 1,
        updated_at = now()
    WHERE id = OLD.group_id;
    
    -- Increment count in new group
    UPDATE player_groups
    SET player_count = player_count + 1,
        updated_at = now()
    WHERE id = NEW.group_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update player_count
CREATE TRIGGER trigger_update_player_group_count
AFTER INSERT OR UPDATE OR DELETE ON tracked_players
FOR EACH ROW EXECUTE FUNCTION update_player_group_count();

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_player_groups_updated_at
BEFORE UPDATE ON player_groups
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tracked_players_updated_at
BEFORE UPDATE ON tracked_players
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to get player tracking statistics
CREATE OR REPLACE FUNCTION get_player_tracking_stats(p_user_id uuid)
RETURNS TABLE (
  total_groups bigint,
  total_players bigint,
  public_groups bigint,
  private_groups bigint,
  auto_import_players bigint,
  chess_com_players bigint,
  lichess_players bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH user_groups AS (
    SELECT id
    FROM player_groups
    WHERE owner_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = p_user_id
          AND profiles.role IN ('admin', 'administrator')
      )
  )
  SELECT
    COUNT(DISTINCT pg.id)::bigint AS total_groups,
    COUNT(DISTINCT tp.id)::bigint AS total_players,
    COUNT(DISTINCT pg.id) FILTER (WHERE pg.is_public = true)::bigint AS public_groups,
    COUNT(DISTINCT pg.id) FILTER (WHERE pg.is_public = false)::bigint AS private_groups,
    COUNT(DISTINCT tp.id) FILTER (WHERE tp.auto_import = true)::bigint AS auto_import_players,
    COUNT(DISTINCT tp.id) FILTER (WHERE tp.site = 'Chess.com')::bigint AS chess_com_players,
    COUNT(DISTINCT tp.id) FILTER (WHERE tp.site = 'Lichess')::bigint AS lichess_players
  FROM player_groups pg
  LEFT JOIN tracked_players tp ON pg.id = tp.group_id
  WHERE pg.id IN (SELECT id FROM user_groups);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for player tracking dashboard
CREATE OR REPLACE VIEW v_player_tracking_dashboard AS
SELECT
  pg.id AS group_id,
  pg.name AS group_name,
  pg.description,
  pg.is_public,
  pg.owner_id,
  pg.player_count,
  COUNT(tp.id) AS actual_player_count,
  COUNT(tp.id) FILTER (WHERE tp.auto_import = true) AS auto_import_count,
  COUNT(tp.id) FILTER (WHERE tp.site = 'Chess.com') AS chess_com_count,
  COUNT(tp.id) FILTER (WHERE tp.site = 'Lichess') AS lichess_count,
  MAX(tp.last_import) AS last_import,
  pg.created_at,
  pg.updated_at
FROM player_groups pg
LEFT JOIN tracked_players tp ON pg.id = tp.group_id
GROUP BY pg.id, pg.name, pg.description, pg.is_public, pg.owner_id, pg.player_count, pg.created_at, pg.updated_at;

-- Grant permissions
GRANT SELECT ON v_player_tracking_dashboard TO authenticated;