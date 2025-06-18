/*
  # Create Players Storage Bucket

  1. New Storage Bucket
    - `players` bucket for player-specific data
    - Profile pictures, avatars, and player documents
    - Separate from chess-games bucket for better organization

  2. Security
    - Enable RLS on storage.objects
    - Users can manage their own player data
    - Admins can access all player data
    - Service role has full access

  3. File Types
    - Profile pictures (jpg, png, webp)
    - Player documents (pdf, txt)
    - Analysis reports (json, csv)
*/

-- Create the players storage bucket (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'players'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'players',
      'players',
      false,
      10485760, -- 10MB limit for player files
      ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
        'text/plain',
        'application/json',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    );
  END IF;
END $$;

-- Drop existing policies for players bucket to avoid conflicts
DROP POLICY IF EXISTS "Users can upload player files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own player files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own player files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own player files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage player files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can access all player files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view player avatars" ON storage.objects;

-- Policy: Users can upload files to their own player folder
CREATE POLICY "Users can upload player files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'players' AND
  (storage.foldername(name))[1] = 'users' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can view their own player files
CREATE POLICY "Users can view own player files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'players' AND
  (
    -- Own files
    (
      (storage.foldername(name))[1] = 'users' AND
      (storage.foldername(name))[2] = auth.uid()::text
    ) OR
    -- Public avatars (for display purposes)
    (storage.foldername(name))[1] = 'avatars'
  )
);

-- Policy: Users can update their own player files
CREATE POLICY "Users can update own player files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'players' AND
  (storage.foldername(name))[1] = 'users' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can delete their own player files
CREATE POLICY "Users can delete own player files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'players' AND
  (storage.foldername(name))[1] = 'users' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Service role can manage all player files
CREATE POLICY "Service role can manage player files"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'players')
WITH CHECK (bucket_id = 'players');

-- Policy: Admins can access all player files
CREATE POLICY "Admins can access all player files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'players' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'administrator')
  )
)
WITH CHECK (
  bucket_id = 'players' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'administrator')
  )
);

-- Policy: Public can view player avatars (for leaderboards, etc.)
CREATE POLICY "Public can view player avatars"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'players' AND
  (storage.foldername(name))[1] = 'avatars'
);

-- Create player_files table to track player-specific uploads
CREATE TABLE IF NOT EXISTS player_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('avatar', 'document', 'analysis', 'report')),
  is_public boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on player_files table
ALTER TABLE player_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on player_files to avoid conflicts
DROP POLICY IF EXISTS "Users can view own player files" ON player_files;
DROP POLICY IF EXISTS "Users can insert own player files" ON player_files;
DROP POLICY IF EXISTS "Users can update own player files" ON player_files;
DROP POLICY IF EXISTS "Users can delete own player files" ON player_files;
DROP POLICY IF EXISTS "Service role can manage all player files" ON player_files;
DROP POLICY IF EXISTS "Admins can access all player files" ON player_files;
DROP POLICY IF EXISTS "Public can view public player files" ON player_files;

-- RLS policies for player_files
CREATE POLICY "Users can view own player files"
ON player_files
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "Users can insert own player files"
ON player_files
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own player files"
ON player_files
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own player files"
ON player_files
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Service role can manage all player files
CREATE POLICY "Service role can manage all player files"
ON player_files
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admins can access all player files
CREATE POLICY "Admins can access all player files"
ON player_files
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'administrator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'administrator')
  )
);

-- Public can view public player files
CREATE POLICY "Public can view public player files"
ON player_files
FOR SELECT
TO anon, authenticated
USING (is_public = true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_player_files_player_id ON player_files(player_id);
CREATE INDEX IF NOT EXISTS idx_player_files_user_id ON player_files(user_id);
CREATE INDEX IF NOT EXISTS idx_player_files_file_type ON player_files(file_type);
CREATE INDEX IF NOT EXISTS idx_player_files_is_public ON player_files(is_public);
CREATE INDEX IF NOT EXISTS idx_player_files_created_at ON player_files(created_at DESC);

-- Create trigger to update updated_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_player_files_updated_at'
  ) THEN
    CREATE TRIGGER update_player_files_updated_at
      BEFORE UPDATE ON player_files
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Function to get player's file usage
CREATE OR REPLACE FUNCTION get_player_file_usage(player_uuid uuid)
RETURNS TABLE (
  total_files bigint,
  total_size bigint,
  avatar_files bigint,
  document_files bigint,
  analysis_files bigint,
  public_files bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_files,
    COALESCE(SUM(file_size), 0)::bigint as total_size,
    COUNT(*) FILTER (WHERE file_type = 'avatar')::bigint as avatar_files,
    COUNT(*) FILTER (WHERE file_type = 'document')::bigint as document_files,
    COUNT(*) FILTER (WHERE file_type = 'analysis')::bigint as analysis_files,
    COUNT(*) FILTER (WHERE is_public = true)::bigint as public_files
  FROM player_files
  WHERE player_id = player_uuid;
END;
$$;

-- Function to handle player file upload
CREATE OR REPLACE FUNCTION handle_player_file_upload(
  p_player_id uuid,
  p_file_name text,
  p_file_path text,
  p_file_size bigint,
  p_mime_type text,
  p_file_type text,
  p_is_public boolean DEFAULT false,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  file_id uuid;
BEGIN
  INSERT INTO player_files (
    player_id,
    user_id,
    file_name,
    file_path,
    file_size,
    mime_type,
    file_type,
    is_public,
    metadata
  ) VALUES (
    p_player_id,
    auth.uid(),
    p_file_name,
    p_file_path,
    p_file_size,
    p_mime_type,
    p_file_type,
    p_is_public,
    p_metadata
  ) RETURNING id INTO file_id;
  
  RETURN file_id;
END;
$$;

-- Function to set player avatar
CREATE OR REPLACE FUNCTION set_player_avatar(
  p_player_id uuid,
  p_file_path text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the player's avatar_url in profiles table if they own this player
  UPDATE profiles
  SET avatar_url = p_file_path,
      updated_at = now()
  WHERE id = auth.uid();
  
  -- Mark the file as the current avatar
  UPDATE player_files
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'),
    '{is_current_avatar}',
    'true'
  )
  WHERE player_id = p_player_id
    AND file_path = p_file_path
    AND user_id = auth.uid();
  
  -- Unmark other avatar files for this player
  UPDATE player_files
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'),
    '{is_current_avatar}',
    'false'
  )
  WHERE player_id = p_player_id
    AND file_path != p_file_path
    AND file_type = 'avatar'
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Function to clean up old player files
CREATE OR REPLACE FUNCTION cleanup_old_player_files()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete non-avatar files older than 30 days
  DELETE FROM player_files
  WHERE file_type != 'avatar'
    AND created_at < now() - interval '30 days'
    AND is_public = false;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Insert sample avatar files for demonstration
DO $$
BEGIN
  -- Check and insert sample avatar files
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'players' AND name = 'avatars/default_avatar_1.png'
  ) THEN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('players', 'avatars/default_avatar_1.png', null, '{"size": 2048, "mimetype": "image/png", "type": "default_avatar"}');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'players' AND name = 'avatars/default_avatar_2.png'
  ) THEN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('players', 'avatars/default_avatar_2.png', null, '{"size": 2048, "mimetype": "image/png", "type": "default_avatar"}');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'players' AND name = 'avatars/default_avatar_3.png'
  ) THEN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('players', 'avatars/default_avatar_3.png', null, '{"size": 2048, "mimetype": "image/png", "type": "default_avatar"}');
  END IF;
END $$;

-- Create a view for player file statistics
CREATE OR REPLACE VIEW v_player_file_statistics AS
SELECT 
  p.id as player_id,
  p.hash as player_hash,
  COUNT(pf.*) as total_files,
  COALESCE(SUM(pf.file_size), 0) as total_size,
  COUNT(pf.*) FILTER (WHERE pf.file_type = 'avatar') as avatar_files,
  COUNT(pf.*) FILTER (WHERE pf.file_type = 'document') as document_files,
  COUNT(pf.*) FILTER (WHERE pf.file_type = 'analysis') as analysis_files,
  COUNT(pf.*) FILTER (WHERE pf.is_public = true) as public_files,
  MAX(pf.created_at) as last_upload
FROM players p
LEFT JOIN player_files pf ON pf.player_id = p.id
GROUP BY p.id, p.hash;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON player_files TO authenticated;
GRANT SELECT ON v_player_file_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_file_usage TO authenticated;
GRANT EXECUTE ON FUNCTION handle_player_file_upload TO authenticated;
GRANT EXECUTE ON FUNCTION set_player_avatar TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_player_files TO service_role;