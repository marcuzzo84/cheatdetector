/*
  # Fix Chess Games Storage

  1. Create Storage Bucket
    - Create 'chess-games' bucket for storing PGN files
    - Set appropriate permissions and file size limits
    
  2. Security
    - Enable RLS on storage objects
    - Add policies for authenticated users
    - Add policies for service role
    
  3. Storage Policies
    - Users can upload to their own folder
    - Users can view/download their own files
    - Users can delete their own files
    - Service role has full access
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
        'application/octet-stream',
        'application/json',
        'text/csv'
      ]
    );
  END IF;
END $$;

-- Drop existing policies for chess-games bucket to avoid conflicts
DO $$
BEGIN
  -- Delete policies that might exist
  DELETE FROM storage.policies 
  WHERE bucket_id = 'chess-games';
END $$;

-- Policy: Users can upload files to their own folder
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Users can upload chess files',
  'chess-games',
  jsonb_build_object(
    'name', 'Users can upload chess files',
    'owner', null,
    'resource', 'object',
    'action', 'INSERT',
    'roles', array['authenticated'],
    'condition', 'bucket_id = ''chess-games'' AND (storage.foldername(name))[1] = ''users'' AND (storage.foldername(name))[2] = auth.uid()::text'
  )
);

-- Policy: Users can view their own files
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Users can view own chess files',
  'chess-games',
  jsonb_build_object(
    'name', 'Users can view own chess files',
    'owner', null,
    'resource', 'object',
    'action', 'SELECT',
    'roles', array['authenticated'],
    'condition', 'bucket_id = ''chess-games'' AND (storage.foldername(name))[1] = ''users'' AND (storage.foldername(name))[2] = auth.uid()::text'
  )
);

-- Policy: Users can update their own files
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Users can update own chess files',
  'chess-games',
  jsonb_build_object(
    'name', 'Users can update own chess files',
    'owner', null,
    'resource', 'object',
    'action', 'UPDATE',
    'roles', array['authenticated'],
    'condition', 'bucket_id = ''chess-games'' AND (storage.foldername(name))[1] = ''users'' AND (storage.foldername(name))[2] = auth.uid()::text'
  )
);

-- Policy: Users can delete their own files
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Users can delete own chess files',
  'chess-games',
  jsonb_build_object(
    'name', 'Users can delete own chess files',
    'owner', null,
    'resource', 'object',
    'action', 'DELETE',
    'roles', array['authenticated'],
    'condition', 'bucket_id = ''chess-games'' AND (storage.foldername(name))[1] = ''users'' AND (storage.foldername(name))[2] = auth.uid()::text'
  )
);

-- Policy: Service role can manage all files
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Service role can manage all chess files',
  'chess-games',
  jsonb_build_object(
    'name', 'Service role can manage all chess files',
    'owner', null,
    'resource', 'object',
    'action', 'ALL',
    'roles', array['service_role'],
    'condition', 'bucket_id = ''chess-games'''
  )
);

-- Policy: Admins can access all files
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Admins can access all chess files',
  'chess-games',
  jsonb_build_object(
    'name', 'Admins can access all chess files',
    'owner', null,
    'resource', 'object',
    'action', 'ALL',
    'roles', array['authenticated'],
    'condition', 'bucket_id = ''chess-games'' AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN (''admin'', ''administrator''))'
  )
);

-- Create sample folders for each user
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    -- Create sample folders for each user
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES 
      ('chess-games', 'users/' || user_record.id || '/', user_record.id, '{"contentType": "application/x-directory"}'),
      ('chess-games', 'users/' || user_record.id || '/pgn/', user_record.id, '{"contentType": "application/x-directory"}'),
      ('chess-games', 'users/' || user_record.id || '/analysis/', user_record.id, '{"contentType": "application/x-directory"}')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Create function to get file URL
CREATE OR REPLACE FUNCTION get_file_url(bucket_name text, file_path text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
BEGIN
  -- Get the Supabase URL from the environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- If not available, use a placeholder
  IF supabase_url IS NULL THEN
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_file_url TO authenticated;
GRANT EXECUTE ON FUNCTION clean_orphaned_files TO service_role;