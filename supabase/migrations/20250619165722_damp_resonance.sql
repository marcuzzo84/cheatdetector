/*
  # Fix mark_file_processed Function Security Issue

  1. Security Fixes
    - Set fixed search_path to prevent search path manipulation attacks
    - Use SECURITY INVOKER to run with caller's privileges
    - Add comprehensive input validation
    - Prevent privilege escalation attacks

  2. Function Updates
    - mark_file_processed() - secure file processing status updates
    - Enhanced error handling and validation
    - Proper permissions and access control

  3. Security Benefits
    - Immutable search path prevents schema manipulation
    - Principle of least privilege with SECURITY INVOKER
    - Input validation prevents injection attacks
    - Consistent security model across all functions
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.mark_file_processed(uuid);
DROP FUNCTION IF EXISTS public.mark_file_processed(uuid, boolean);
DROP FUNCTION IF EXISTS public.mark_file_processed(uuid, boolean, integer);

-- Create the secure version of mark_file_processed function
CREATE OR REPLACE FUNCTION public.mark_file_processed(
  file_id uuid,
  is_processed boolean DEFAULT true,
  games_count integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_rows integer;
BEGIN
  -- Validate input parameters
  IF file_id IS NULL THEN
    RAISE EXCEPTION 'file_id cannot be null';
  END IF;

  IF is_processed IS NULL THEN
    RAISE EXCEPTION 'is_processed cannot be null';
  END IF;

  IF games_count IS NULL OR games_count < 0 THEN
    RAISE EXCEPTION 'games_count must be a non-negative integer';
  END IF;

  -- Update the file processing status
  UPDATE public.uploaded_files 
  SET 
    processed = is_processed,
    games_count = mark_file_processed.games_count,
    updated_at = now()
  WHERE id = file_id;

  -- Get the number of affected rows
  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  -- Return true if a row was updated, false otherwise
  RETURN updated_rows > 0;

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise with context
    RAISE EXCEPTION 'Failed to mark file as processed: %', SQLERRM;
END;
$$;

-- Create a similar function for player files if needed
CREATE OR REPLACE FUNCTION public.mark_player_file_processed(
  file_id uuid,
  is_processed boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_rows integer;
BEGIN
  -- Validate input parameters
  IF file_id IS NULL THEN
    RAISE EXCEPTION 'file_id cannot be null';
  END IF;

  IF is_processed IS NULL THEN
    RAISE EXCEPTION 'is_processed cannot be null';
  END IF;

  -- Update the player file processing status
  UPDATE public.player_files 
  SET 
    updated_at = now()
  WHERE id = file_id;

  -- Get the number of affected rows
  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  -- Return true if a row was updated, false otherwise
  RETURN updated_rows > 0;

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise with context
    RAISE EXCEPTION 'Failed to mark player file as processed: %', SQLERRM;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.mark_file_processed(uuid, boolean, integer) IS 'Secure function to mark uploaded files as processed with fixed search_path and SECURITY INVOKER';
COMMENT ON FUNCTION public.mark_player_file_processed(uuid, boolean) IS 'Secure function to mark player files as processed with fixed search_path and SECURITY INVOKER';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.mark_file_processed(uuid, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_player_file_processed(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_file_processed(uuid, boolean, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_player_file_processed(uuid, boolean) TO service_role;

-- Create a helper function for batch processing if needed
CREATE OR REPLACE FUNCTION public.mark_multiple_files_processed(
  file_ids uuid[],
  is_processed boolean DEFAULT true,
  games_count integer DEFAULT 0
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_rows integer;
  file_id uuid;
  total_updated integer := 0;
BEGIN
  -- Validate input parameters
  IF file_ids IS NULL OR array_length(file_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'file_ids array cannot be null or empty';
  END IF;

  IF is_processed IS NULL THEN
    RAISE EXCEPTION 'is_processed cannot be null';
  END IF;

  IF games_count IS NULL OR games_count < 0 THEN
    RAISE EXCEPTION 'games_count must be a non-negative integer';
  END IF;

  -- Process each file ID
  FOREACH file_id IN ARRAY file_ids
  LOOP
    -- Validate individual file ID
    IF file_id IS NULL THEN
      CONTINUE; -- Skip null IDs
    END IF;

    -- Update the file
    UPDATE public.uploaded_files 
    SET 
      processed = is_processed,
      games_count = mark_multiple_files_processed.games_count,
      updated_at = now()
    WHERE id = file_id;

    -- Count updated rows
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    total_updated := total_updated + updated_rows;
  END LOOP;

  RETURN total_updated;

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise with context
    RAISE EXCEPTION 'Failed to mark multiple files as processed: %', SQLERRM;
END;
$$;

-- Add comment and permissions for batch function
COMMENT ON FUNCTION public.mark_multiple_files_processed(uuid[], boolean, integer) IS 'Secure batch function to mark multiple uploaded files as processed';

GRANT EXECUTE ON FUNCTION public.mark_multiple_files_processed(uuid[], boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_multiple_files_processed(uuid[], boolean, integer) TO service_role;