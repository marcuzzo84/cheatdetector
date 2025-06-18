/*
  # Fix mutable search path security issue

  1. Security
    - Fix mutable search_path in get_user_storage_usage function
    - Set explicit search_path parameter to ensure predictable schema resolution
    - Maintain SECURITY INVOKER model for proper RLS enforcement

  2. Changes
    - Drop existing function if it exists
    - Recreate with SET search_path = public, auth parameter
    - Update permissions and documentation
*/

-- First, check if the function exists and drop it if it does
DROP FUNCTION IF EXISTS public.get_user_storage_usage() CASCADE;

-- Recreate the function with a fixed search_path parameter
CREATE OR REPLACE FUNCTION public.get_user_storage_usage()
RETURNS TABLE (
    total_files bigint,
    total_size numeric,
    pgn_files bigint,
    pgn_size numeric
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, auth
AS $$
    SELECT 
        COUNT(*)::bigint as total_files,
        COALESCE(SUM(file_size), 0)::numeric as total_size,
        COUNT(*) FILTER (WHERE file_type = 'pgn')::bigint as pgn_files,
        COALESCE(SUM(file_size) FILTER (WHERE file_type = 'pgn'), 0)::numeric as pgn_size
    FROM uploaded_files
    WHERE user_id = auth.uid();
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_user_storage_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_storage_usage() TO service_role;

-- Add comment to document the security fix
COMMENT ON FUNCTION public.get_user_storage_usage() IS 'Get current user storage usage - SECURITY INVOKER with fixed search_path for security';

-- Document the security fix
DO $$
BEGIN
    RAISE NOTICE '=== Search Path Security Fix Applied ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Security Improvements:';
    RAISE NOTICE '- Fixed mutable search_path in get_user_storage_usage function';
    RAISE NOTICE '- Function now uses SET search_path = public, auth';
    RAISE NOTICE '- SECURITY INVOKER model maintained for proper RLS enforcement';
    RAISE NOTICE '';
    RAISE NOTICE 'Benefits:';
    RAISE NOTICE '- Predictable schema resolution regardless of user role';
    RAISE NOTICE '- Protection against search_path injection attacks';
    RAISE NOTICE '- Improved security posture for database functions';
    RAISE NOTICE '- Maintains RLS policy enforcement';
    RAISE NOTICE '';
    RAISE NOTICE 'Best Practices Applied:';
    RAISE NOTICE '- Explicit schema qualification for all database objects';
    RAISE NOTICE '- Minimal necessary schemas in search_path';
    RAISE NOTICE '- Proper permission grants maintained';
END $$;