/*
  # Fix File Upload Function Security Issue

  1. Security Fix
    - Set explicit search_path for handle_file_upload function
    - Use SECURITY INVOKER to run with caller's privileges
    - Prevent search path manipulation attacks

  2. Function Updates
    - Add explicit search_path parameter
    - Ensure function runs in secure context
    - Maintain existing functionality
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.handle_file_upload();

-- Create the secure version of the file upload handler
CREATE OR REPLACE FUNCTION public.handle_file_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Validate that we have a user_id
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;

  -- Set default values if not provided
  IF NEW.processed IS NULL THEN
    NEW.processed = false;
  END IF;

  IF NEW.games_count IS NULL THEN
    NEW.games_count = 0;
  END IF;

  IF NEW.metadata IS NULL THEN
    NEW.metadata = '{}'::jsonb;
  END IF;

  -- Set timestamps
  IF NEW.created_at IS NULL THEN
    NEW.created_at = now();
  END IF;

  NEW.updated_at = now();

  -- Validate file_type
  IF NEW.file_type NOT IN ('pgn', 'analysis', 'sample') THEN
    RAISE EXCEPTION 'Invalid file_type. Must be pgn, analysis, or sample';
  END IF;

  -- Validate file_size
  IF NEW.file_size IS NULL OR NEW.file_size <= 0 THEN
    RAISE EXCEPTION 'file_size must be a positive number';
  END IF;

  -- Validate file_name
  IF NEW.file_name IS NULL OR trim(NEW.file_name) = '' THEN
    RAISE EXCEPTION 'file_name cannot be empty';
  END IF;

  -- Validate file_path
  IF NEW.file_path IS NULL OR trim(NEW.file_path) = '' THEN
    RAISE EXCEPTION 'file_path cannot be empty';
  END IF;

  RETURN NEW;
END;
$$;

-- Create a similar secure function for player files if it exists
DROP FUNCTION IF EXISTS public.handle_player_file_upload();

CREATE OR REPLACE FUNCTION public.handle_player_file_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Validate that we have required IDs
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;

  -- Set default values if not provided
  IF NEW.is_public IS NULL THEN
    NEW.is_public = false;
  END IF;

  IF NEW.metadata IS NULL THEN
    NEW.metadata = '{}'::jsonb;
  END IF;

  -- Set timestamps
  IF NEW.created_at IS NULL THEN
    NEW.created_at = now();
  END IF;

  NEW.updated_at = now();

  -- Validate file_type
  IF NEW.file_type NOT IN ('avatar', 'document', 'analysis', 'report') THEN
    RAISE EXCEPTION 'Invalid file_type. Must be avatar, document, analysis, or report';
  END IF;

  -- Validate file_size
  IF NEW.file_size IS NULL OR NEW.file_size <= 0 THEN
    RAISE EXCEPTION 'file_size must be a positive number';
  END IF;

  -- Validate file_name
  IF NEW.file_name IS NULL OR trim(NEW.file_name) = '' THEN
    RAISE EXCEPTION 'file_name cannot be empty';
  END IF;

  -- Validate file_path
  IF NEW.file_path IS NULL OR trim(NEW.file_path) = '' THEN
    RAISE EXCEPTION 'file_path cannot be empty';
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate triggers with the secure functions
DROP TRIGGER IF EXISTS trigger_handle_file_upload ON public.uploaded_files;
CREATE TRIGGER trigger_handle_file_upload
  BEFORE INSERT OR UPDATE ON public.uploaded_files
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_file_upload();

DROP TRIGGER IF EXISTS trigger_handle_player_file_upload ON public.player_files;
CREATE TRIGGER trigger_handle_player_file_upload
  BEFORE INSERT OR UPDATE ON public.player_files
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_player_file_upload();

-- Add comments for documentation
COMMENT ON FUNCTION public.handle_file_upload() IS 'Secure file upload handler with fixed search_path and SECURITY INVOKER';
COMMENT ON FUNCTION public.handle_player_file_upload() IS 'Secure player file upload handler with fixed search_path and SECURITY INVOKER';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_file_upload() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_player_file_upload() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_file_upload() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_player_file_upload() TO service_role;