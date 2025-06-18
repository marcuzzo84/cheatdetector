/*
  # Storage and File Management Setup

  1. Tables
    - `uploaded_files` - Track user uploaded files with metadata
  
  2. Functions
    - `get_user_storage_usage()` - Get storage statistics for users
    - `cleanup_old_unprocessed_files()` - Maintenance function
  
  3. Security
    - Enable RLS on uploaded_files table
    - Add policies for user file access control
    - Admin and service role policies
*/

-- Create uploaded_files table if it doesn't exist
CREATE TABLE IF NOT EXISTS uploaded_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pgn', 'analysis', 'sample')),
  games_count integer DEFAULT 0,
  processed boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on uploaded_files table
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on uploaded_files to avoid conflicts
DROP POLICY IF EXISTS "Users can view own uploaded files" ON uploaded_files;
DROP POLICY IF EXISTS "Users can insert own uploaded files" ON uploaded_files;
DROP POLICY IF EXISTS "Users can update own uploaded files" ON uploaded_files;
DROP POLICY IF EXISTS "Users can delete own uploaded files" ON uploaded_files;
DROP POLICY IF EXISTS "Service role can manage all uploaded files" ON uploaded_files;
DROP POLICY IF EXISTS "Admins can access all uploaded files" ON uploaded_files;

-- RLS policies for uploaded_files
CREATE POLICY "Users can view own uploaded files"
ON uploaded_files
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own uploaded files"
ON uploaded_files
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own uploaded files"
ON uploaded_files
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own uploaded files"
ON uploaded_files
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Service role can manage all uploaded files
CREATE POLICY "Service role can manage all uploaded files"
ON uploaded_files
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admins can access all uploaded files
CREATE POLICY "Admins can access all uploaded files"
ON uploaded_files
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

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_file_type ON uploaded_files(file_type);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_processed ON uploaded_files(processed);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_created_at ON uploaded_files(created_at DESC);

-- Create trigger to update updated_at timestamp (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_uploaded_files_updated_at'
  ) THEN
    CREATE TRIGGER update_uploaded_files_updated_at
      BEFORE UPDATE ON uploaded_files
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Function to get user's storage usage
CREATE OR REPLACE FUNCTION get_user_storage_usage(user_uuid uuid DEFAULT auth.uid())
RETURNS TABLE (
  total_files bigint,
  total_size bigint,
  pgn_files bigint,
  pgn_size bigint,
  analysis_files bigint,
  analysis_size bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_files,
    COALESCE(SUM(file_size), 0)::bigint as total_size,
    COUNT(*) FILTER (WHERE file_type = 'pgn')::bigint as pgn_files,
    COALESCE(SUM(file_size) FILTER (WHERE file_type = 'pgn'), 0)::bigint as pgn_size,
    COUNT(*) FILTER (WHERE file_type = 'analysis')::bigint as analysis_files,
    COALESCE(SUM(file_size) FILTER (WHERE file_type = 'analysis'), 0)::bigint as analysis_size
  FROM uploaded_files
  WHERE user_id = user_uuid;
END;
$$;

-- Function to clean up old unprocessed files (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_unprocessed_files()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete files older than 7 days that haven't been processed
  DELETE FROM uploaded_files
  WHERE processed = false
    AND created_at < now() - interval '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Function to handle file upload tracking
CREATE OR REPLACE FUNCTION handle_file_upload(
  p_file_name text,
  p_file_path text,
  p_file_size bigint,
  p_mime_type text,
  p_file_type text,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  file_id uuid;
BEGIN
  INSERT INTO uploaded_files (
    user_id,
    file_name,
    file_path,
    file_size,
    mime_type,
    file_type,
    metadata
  ) VALUES (
    auth.uid(),
    p_file_name,
    p_file_path,
    p_file_size,
    p_mime_type,
    p_file_type,
    p_metadata
  ) RETURNING id INTO file_id;
  
  RETURN file_id;
END;
$$;

-- Function to mark file as processed
CREATE OR REPLACE FUNCTION mark_file_processed(
  p_file_id uuid,
  p_games_count integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE uploaded_files
  SET 
    processed = true,
    games_count = p_games_count,
    updated_at = now()
  WHERE id = p_file_id
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Create a view for file statistics
CREATE OR REPLACE VIEW v_file_statistics AS
SELECT 
  u.id as user_id,
  p.full_name,
  COUNT(uf.*) as total_files,
  COALESCE(SUM(uf.file_size), 0) as total_size,
  COUNT(uf.*) FILTER (WHERE uf.file_type = 'pgn') as pgn_files,
  COALESCE(SUM(uf.file_size) FILTER (WHERE uf.file_type = 'pgn'), 0) as pgn_size,
  COUNT(uf.*) FILTER (WHERE uf.processed = true) as processed_files,
  COALESCE(SUM(uf.games_count), 0) as total_games,
  MAX(uf.created_at) as last_upload
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN uploaded_files uf ON uf.user_id = u.id
GROUP BY u.id, p.full_name;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON uploaded_files TO authenticated;
GRANT SELECT ON v_file_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_storage_usage TO authenticated;
GRANT EXECUTE ON FUNCTION handle_file_upload TO authenticated;
GRANT EXECUTE ON FUNCTION mark_file_processed TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_unprocessed_files TO service_role;