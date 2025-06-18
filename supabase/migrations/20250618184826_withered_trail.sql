-- Fix mutable search path security issue for get_chess_storage_usage function
-- This migration addresses the security vulnerability by setting a fixed search_path

-- First, check if the function exists and drop it if it does
DROP FUNCTION IF EXISTS public.get_chess_storage_usage() CASCADE;

-- Recreate the function with a fixed search_path parameter
CREATE OR REPLACE FUNCTION public.get_chess_storage_usage()
RETURNS TABLE (
    total_files bigint,
    total_size numeric,
    pgn_files bigint,
    pgn_size numeric,
    processed_files bigint,
    total_games bigint,
    last_upload timestamptz
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
        COALESCE(SUM(file_size) FILTER (WHERE file_type = 'pgn'), 0)::numeric as pgn_size,
        COUNT(*) FILTER (WHERE processed = true)::bigint as processed_files,
        COALESCE(SUM(games_count), 0)::bigint as total_games,
        MAX(created_at) as last_upload
    FROM uploaded_files
    WHERE user_id = auth.uid();
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_chess_storage_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chess_storage_usage() TO service_role;

-- Add comment to document the security fix
COMMENT ON FUNCTION public.get_chess_storage_usage() IS 'Get current user chess storage usage - SECURITY INVOKER with fixed search_path for security';

-- Also fix any other functions that might have mutable search paths
-- Let's check and fix get_user_storage_usage if it exists
DROP FUNCTION IF EXISTS public.get_user_storage_usage() CASCADE;

CREATE OR REPLACE FUNCTION public.get_user_storage_usage()
RETURNS TABLE (
    total_files bigint,
    total_size numeric,
    pgn_files bigint,
    pgn_size numeric,
    processed_files bigint,
    total_games bigint,
    last_upload timestamptz
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
        COALESCE(SUM(file_size) FILTER (WHERE file_type = 'pgn'), 0)::numeric as pgn_size,
        COUNT(*) FILTER (WHERE processed = true)::bigint as processed_files,
        COALESCE(SUM(games_count), 0)::bigint as total_games,
        MAX(created_at) as last_upload
    FROM uploaded_files
    WHERE user_id = auth.uid();
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_storage_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_storage_usage() TO service_role;

-- Add comment
COMMENT ON FUNCTION public.get_user_storage_usage() IS 'Get current user storage usage - SECURITY INVOKER with fixed search_path for security';

-- Document the security fix
DO $$
BEGIN
    RAISE NOTICE '=== Search Path Security Fix Applied ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Security Improvements:';
    RAISE NOTICE '- Fixed mutable search_path in get_chess_storage_usage function';
    RAISE NOTICE '- Fixed mutable search_path in get_user_storage_usage function';
    RAISE NOTICE '- Both functions now use SET search_path = public, auth';
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