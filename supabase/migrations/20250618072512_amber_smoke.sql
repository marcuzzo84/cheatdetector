/*
  # Storage Bucket and File Management Setup

  1. Storage Configuration
    - Create chess-games bucket with proper settings
    - Set up file size limits and MIME type restrictions
    - Configure security policies for user access

  2. File Management Table
    - Create uploaded_files table for tracking file metadata
    - Set up RLS policies for secure access
    - Add indexes for performance optimization

  3. Security Policies
    - Users can only access their own files
    - Admins can access all files
    - Service role has full access
    - Public sample files are accessible to all users

  4. Utility Functions
    - Storage usage tracking
    - File cleanup maintenance
*/

-- Create the chess-games storage bucket (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'chess-games'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'chess-games',
      'chess-games',
      false,
      52428800, -- 50MB limit
      ARRAY[
        'text/plain',
        'application/json',
        'text/x-chess-pgn',
        'application/x-chess-pgn'
      ]
    );
  END IF;
END $$;

-- Enable RLS on storage.objects (safe to run multiple times)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can access all files" ON storage.objects;

-- Policy: Users can upload files to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chess-games' AND
  (storage.foldername(name))[1] = 'users' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can view their own files
CREATE POLICY "Users can view own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chess-games' AND
  (
    -- Own files
    (
      (storage.foldername(name))[1] = 'users' AND
      (storage.foldername(name))[2] = auth.uid()::text
    ) OR
    -- Public sample files
    (storage.foldername(name))[1] = 'public'
  )
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chess-games' AND
  (storage.foldername(name))[1] = 'users' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chess-games' AND
  (storage.foldername(name))[1] = 'users' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Service role can manage all files
CREATE POLICY "Service role can manage all files"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'chess-games')
WITH CHECK (bucket_id = 'chess-games');

-- Policy: Admins can access all files
CREATE POLICY "Admins can access all files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'chess-games' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'administrator')
  )
)
WITH CHECK (
  bucket_id = 'chess-games' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'administrator')
  )
);

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

-- Insert sample files only if they don't already exist
DO $$
BEGIN
  -- Check and insert sample files
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'chess-games' AND name = 'public/samples/sample_game_1.pgn'
  ) THEN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('chess-games', 'public/samples/sample_game_1.pgn', null, '{"size": 1024, "mimetype": "text/x-chess-pgn"}');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'chess-games' AND name = 'public/samples/sample_game_2.pgn'
  ) THEN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('chess-games', 'public/samples/sample_game_2.pgn', null, '{"size": 2048, "mimetype": "text/x-chess-pgn"}');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'chess-games' AND name = 'public/samples/analysis_example.json'
  ) THEN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('chess-games', 'public/samples/analysis_example.json', null, '{"size": 512, "mimetype": "application/json"}');
  END IF;
END $$;