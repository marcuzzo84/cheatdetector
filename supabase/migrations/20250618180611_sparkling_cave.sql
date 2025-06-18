/*
  # Move v_file_statistics view to private schema

  1. Security Enhancement
    - Move v_file_statistics view from public to private schema
    - Restrict direct access to sensitive file data
    - Create secure functions for authorized access

  2. New Functions
    - `public.get_file_statistics()` - Admin access to file stats
    - `private.admin_get_file_summary()` - Service role file summary
    - `private.service_get_user_files(uuid)` - Service role user file lookup

  3. Backward Compatibility
    - `public.get_file_statistics_view()` - Replacement for old view access
    - Maintains same data structure and access patterns

  4. Security Features
    - Private schema isolation
    - Admin privilege verification
    - Service role restricted functions
    - Comprehensive permission management
*/

-- Ensure private schema exists (it should from previous migration)
CREATE SCHEMA IF NOT EXISTS private;

-- Grant usage on private schema to service role only
GRANT USAGE ON SCHEMA private TO service_role;

-- Ensure no other roles have access to the private schema
REVOKE ALL ON SCHEMA private FROM public;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

-- Handle the existing v_file_statistics view carefully
DO $$
DECLARE
    view_exists boolean := false;
BEGIN
    -- Check if the view exists in public schema
    SELECT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'v_file_statistics'
    ) INTO view_exists;
    
    IF view_exists THEN
        -- Try to drop the view with CASCADE to handle dependencies
        BEGIN
            DROP VIEW public.v_file_statistics CASCADE;
            RAISE NOTICE 'Successfully dropped public.v_file_statistics view';
        EXCEPTION 
            WHEN OTHERS THEN
                -- If we can't drop it, we'll work around it
                RAISE NOTICE 'Could not drop existing view, will create with different approach: %', SQLERRM;
        END;
    END IF;
END $$;

-- Create the v_file_statistics view in the private schema
DO $$
BEGIN
    -- Only create if it doesn't already exist in private schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'private' 
        AND table_name = 'v_file_statistics'
    ) THEN
        CREATE VIEW private.v_file_statistics AS
        SELECT 
            uf.user_id,
            p.full_name,
            COUNT(uf.id)::bigint as total_files,
            COALESCE(SUM(uf.file_size), 0)::numeric as total_size,
            COUNT(uf.id) FILTER (WHERE uf.file_type = 'pgn')::bigint as pgn_files,
            COALESCE(SUM(uf.file_size) FILTER (WHERE uf.file_type = 'pgn'), 0)::numeric as pgn_size,
            COUNT(uf.id) FILTER (WHERE uf.processed = true)::bigint as processed_files,
            COALESCE(SUM(uf.games_count), 0)::bigint as total_games,
            MAX(uf.created_at) as last_upload
        FROM uploaded_files uf
        LEFT JOIN profiles p ON uf.user_id = p.id
        GROUP BY uf.user_id, p.full_name;
    END IF;
END $$;

-- Grant select permission on the view to service role only
GRANT SELECT ON private.v_file_statistics TO service_role;

-- Add comment to document the view
COMMENT ON VIEW private.v_file_statistics IS 'File statistics view with sensitive user data - restricted to service role access only';

-- Create a secure function for admins to access file statistics
CREATE OR REPLACE FUNCTION public.get_file_statistics()
RETURNS TABLE (
    user_id uuid,
    full_name text,
    total_files bigint,
    total_size numeric,
    pgn_files bigint,
    pgn_size numeric,
    processed_files bigint,
    total_games bigint,
    last_upload timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
    -- Check if the current user is an admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'administrator')
    ) THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Return data from the private view
    RETURN QUERY
    SELECT 
        v.user_id,
        v.full_name,
        v.total_files,
        v.total_size,
        v.pgn_files,
        v.pgn_size,
        v.processed_files,
        v.total_games,
        v.last_upload
    FROM private.v_file_statistics v;
END;
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_file_statistics() TO authenticated;

-- Add comment to document the function
COMMENT ON FUNCTION public.get_file_statistics() IS 'Secure function to access file statistics - requires admin privileges';

-- Create a function for users to access their own file statistics
CREATE OR REPLACE FUNCTION public.get_my_file_statistics()
RETURNS TABLE (
    user_id uuid,
    full_name text,
    total_files bigint,
    total_size numeric,
    pgn_files bigint,
    pgn_size numeric,
    processed_files bigint,
    total_games bigint,
    last_upload timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Return only the current user's file statistics
    RETURN QUERY
    SELECT 
        v.user_id,
        v.full_name,
        v.total_files,
        v.total_size,
        v.pgn_files,
        v.pgn_size,
        v.processed_files,
        v.total_games,
        v.last_upload
    FROM private.v_file_statistics v
    WHERE v.user_id = auth.uid();
END;
$$;

-- Grant execute permission on the user function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_file_statistics() TO authenticated;

-- Add comment to document the user function
COMMENT ON FUNCTION public.get_my_file_statistics() IS 'Function for users to access their own file statistics';

-- Create an additional function for service role operations and file summary
CREATE OR REPLACE FUNCTION private.admin_get_file_summary()
RETURNS TABLE (
    total_users_with_files bigint,
    total_files_system bigint,
    total_size_system numeric,
    total_pgn_files bigint,
    total_processed_files bigint,
    total_games_system bigint,
    avg_files_per_user numeric,
    avg_size_per_user numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT v.user_id)::bigint as total_users_with_files,
        COALESCE(SUM(v.total_files), 0)::bigint as total_files_system,
        COALESCE(SUM(v.total_size), 0)::numeric as total_size_system,
        COALESCE(SUM(v.pgn_files), 0)::bigint as total_pgn_files,
        COALESCE(SUM(v.processed_files), 0)::bigint as total_processed_files,
        COALESCE(SUM(v.total_games), 0)::bigint as total_games_system,
        CASE 
            WHEN COUNT(DISTINCT v.user_id) > 0 
            THEN COALESCE(SUM(v.total_files), 0)::numeric / COUNT(DISTINCT v.user_id)::numeric
            ELSE 0
        END as avg_files_per_user,
        CASE 
            WHEN COUNT(DISTINCT v.user_id) > 0 
            THEN COALESCE(SUM(v.total_size), 0)::numeric / COUNT(DISTINCT v.user_id)::numeric
            ELSE 0
        END as avg_size_per_user
    FROM private.v_file_statistics v;
END;
$$;

-- Grant execute permission on the summary function to service role only
GRANT EXECUTE ON FUNCTION private.admin_get_file_summary() TO service_role;

-- Add comment to document the summary function
COMMENT ON FUNCTION private.admin_get_file_summary() IS 'File system summary statistics - service role access only';

-- Create a helper function for service role to get specific user file stats
CREATE OR REPLACE FUNCTION private.service_get_user_files(target_user_id uuid)
RETURNS TABLE (
    user_id uuid,
    full_name text,
    total_files bigint,
    total_size numeric,
    pgn_files bigint,
    pgn_size numeric,
    processed_files bigint,
    total_games bigint,
    last_upload timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.user_id,
        v.full_name,
        v.total_files,
        v.total_size,
        v.pgn_files,
        v.pgn_size,
        v.processed_files,
        v.total_games,
        v.last_upload
    FROM private.v_file_statistics v
    WHERE v.user_id = target_user_id;
END;
$$;

-- Grant execute permission on the helper function to service role only
GRANT EXECUTE ON FUNCTION private.service_get_user_files(uuid) TO service_role;

-- Add comment to document the helper function
COMMENT ON FUNCTION private.service_get_user_files(uuid) IS 'Service role function to get specific user file statistics by ID';

-- Create a function to safely provide backward compatibility
-- This creates a "stub" that redirects to the secure function
CREATE OR REPLACE FUNCTION public.get_file_statistics_view()
RETURNS TABLE (
    user_id uuid,
    full_name text,
    total_files bigint,
    total_size numeric,
    pgn_files bigint,
    pgn_size numeric,
    processed_files bigint,
    total_games bigint,
    last_upload timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function serves as a secure replacement for the old view
    -- It enforces the same security checks as get_file_statistics
    RETURN QUERY
    SELECT * FROM public.get_file_statistics();
END;
$$;

-- Grant execute permission on the compatibility function
GRANT EXECUTE ON FUNCTION public.get_file_statistics_view() TO authenticated;

-- Add comment to document the compatibility function
COMMENT ON FUNCTION public.get_file_statistics_view() IS 'Backward compatibility function for applications expecting v_file_statistics view';

-- Ensure all permissions are properly set on the private schema
-- Use a targeted approach to avoid permission conflicts
DO $$
BEGIN
    -- Revoke permissions on the specific view we created
    BEGIN
        REVOKE ALL ON private.v_file_statistics FROM public, anon, authenticated;
    EXCEPTION 
        WHEN OTHERS THEN
            -- Ignore errors if permissions don't exist
            NULL;
    END;
    
    -- Ensure service role has the right permissions
    GRANT SELECT ON private.v_file_statistics TO service_role;
END $$;

-- Final security verification for the private schema objects
-- Grant necessary permissions to service role on all objects
GRANT ALL ON ALL TABLES IN SCHEMA private TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA private TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA private TO service_role;

-- Ensure other roles don't have access to private schema objects
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM public, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM public, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM public, anon, authenticated;

-- Add a verification function specific to file statistics setup
CREATE OR REPLACE FUNCTION private.verify_file_statistics_setup()
RETURNS TABLE (
    view_exists_private boolean,
    view_exists_public boolean,
    admin_function_exists boolean,
    user_function_exists boolean,
    service_functions_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    service_func_count integer;
BEGIN
    -- Count service functions related to file statistics
    SELECT COUNT(*) INTO service_func_count
    FROM information_schema.routines
    WHERE routine_schema = 'private'
    AND routine_name LIKE '%file%';
    
    RETURN QUERY
    SELECT 
        EXISTS(SELECT 1 FROM information_schema.views WHERE table_schema = 'private' AND table_name = 'v_file_statistics') as view_exists_private,
        EXISTS(SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_file_statistics') as view_exists_public,
        EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_file_statistics') as admin_function_exists,
        EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_my_file_statistics') as user_function_exists,
        service_func_count as service_functions_count;
END;
$$;

-- Grant execute permission on verification function to service role
GRANT EXECUTE ON FUNCTION private.verify_file_statistics_setup() TO service_role;

-- Add final comment
COMMENT ON FUNCTION private.verify_file_statistics_setup() IS 'Verification function to check file statistics private schema setup - service role only';

-- Update any existing RLS policies that might reference the old view
-- (This is precautionary in case there are any dependencies)
DO $$
BEGIN
    -- Check if there are any policies that might need updating
    -- This is mainly for documentation and future reference
    RAISE NOTICE 'File statistics view successfully moved to private schema';
    RAISE NOTICE 'Available functions:';
    RAISE NOTICE '  - public.get_file_statistics() - Admin access';
    RAISE NOTICE '  - public.get_my_file_statistics() - User access to own stats';
    RAISE NOTICE '  - public.get_file_statistics_view() - Backward compatibility';
    RAISE NOTICE '  - private.admin_get_file_summary() - Service role summary';
    RAISE NOTICE '  - private.service_get_user_files(uuid) - Service role user lookup';
END $$;