/*
  # Fix Chess Games Storage Setup

  1. Storage Bucket
    - Create chess-games bucket for file storage
    - Set appropriate size limits and MIME types
    
  2. Storage Policies
    - Users can manage their own files
    - Service role has full access
    - Admins can access all files
    
  3. Helper Functions
    - File URL generation
    - Cleanup utilities
*/

-- Create the chess-games storage bucket (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chess-games',
  'chess-games',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'text/plain',
    'application/octet-stream',
    'application/json',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies using the correct Supabase syntax
-- Policy: Users can upload files to their own folder
CREATE POLICY "Users can upload chess files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chess-games' AND 
  (storage.foldername(name))[1] = 'users' AND 
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can view their own files
CREATE POLICY "Users can view own chess files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chess-games' AND 
  (storage.foldername(name))[1] = 'users' AND 
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update own chess files" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'chess-games' AND 
  (storage.foldername(name))[1] = 'users' AND 
  (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'chess-games' AND 
  (storage.foldername(name))[1] = 'users' AND 
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own chess files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'chess-games' AND 
  (storage.foldername(name))[1] = 'users' AND 
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Service role can manage all files
CREATE POLICY "Service role can manage all chess files" ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'chess-games')
WITH CHECK (bucket_id = 'chess-games');

-- Policy: Admins can access all files
CREATE POLICY "Admins can access all chess files" ON storage.objects
FOR ALL TO authenticated
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

-- Create function to get file URL
CREATE OR REPLACE FUNCTION get_file_url(bucket_name text, file_path text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
BEGIN
  -- Get the Supabase URL from the environment or use a default
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- If not available, construct from current request
  IF supabase_url IS NULL THEN
    supabase_url := 'https://' || current_setting('request.headers', true)::json->>'host';
  END IF;
  
  -- Fallback to a placeholder if still null
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://your-project.supabase.co';
  END IF;
  
  -- Return the constructed URL
  RETURN supabase_url || '/storage/v1/object/public/' || bucket_name || '/' || file_path;
END;
$$;

-- Create function to clean up orphaned files
CREATE OR REPLACE FUNCTION clean_orphaned_files()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete files from uploaded_files that don't exist in storage
  WITH deleted AS (
    DELETE FROM uploaded_files uf
    WHERE NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'chess-games' AND o.name = uf.file_path
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- Create function to get user storage usage
CREATE OR REPLACE FUNCTION get_user_storage_usage()
RETURNS TABLE (
  total_files bigint,
  total_size numeric,
  pgn_files bigint,
  pgn_size numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_files,
    COALESCE(SUM(file_size), 0)::numeric as total_size,
    COUNT(CASE WHEN file_type = 'pgn' THEN 1 END)::bigint as pgn_files,
    COALESCE(SUM(CASE WHEN file_type = 'pgn' THEN file_size ELSE 0 END), 0)::numeric as pgn_size
  FROM uploaded_files
  WHERE user_id = auth.uid();
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated, anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT EXECUTE ON FUNCTION get_file_url TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_storage_usage TO authenticated;
GRANT EXECUTE ON FUNCTION clean_orphaned_files TO service_role;

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create initial folder structure for existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- Only create folders if the bucket exists and has no objects yet
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chess-games') THEN
    FOR user_record IN SELECT id FROM auth.users LIMIT 10 LOOP -- Limit to prevent timeout
      BEGIN
        -- Create user folder structure
        INSERT INTO storage.objects (bucket_id, name, owner, metadata)
        VALUES 
          ('chess-games', 'users/' || user_record.id || '/.keep', user_record.id, '{"contentType": "text/plain"}'),
          ('chess-games', 'users/' || user_record.id || '/pgn/.keep', user_record.id, '{"contentType": "text/plain"}'),
          ('chess-games', 'users/' || user_record.id || '/analysis/.keep', user_record.id, '{"contentType": "text/plain"}')
        ON CONFLICT (bucket_id, name) DO NOTHING;
      EXCEPTION
        WHEN OTHERS THEN
          -- Continue if folder creation fails for any user
          CONTINUE;
      END;
    END LOOP;
  END IF;
END $$;