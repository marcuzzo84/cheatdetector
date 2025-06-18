/*
  # Implement SECURITY INVOKER for File Statistics View

  1. Security Changes
    - Recreate v_file_statistics view with SECURITY INVOKER
    - Ensure RLS policies are properly enforced
    - Remove SECURITY DEFINER functions that bypass RLS
    
  2. RLS Policy Updates
    - Verify uploaded_files table has proper RLS policies
    - Ensure profiles table RLS policies are adequate
    - Add any missing policies for proper access control
    
  3. View Recreation
    - Drop existing private view and functions
    - Create new public view with SECURITY INVOKER
    - Maintain same data structure for compatibility
*/

-- First, ensure RLS is enabled on the underlying tables
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Verify and create necessary RLS policies for uploaded_files table
DO $$
BEGIN
    -- Policy for users to see their own files
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'uploaded_files' 
        AND policyname = 'Users can view own uploaded files'
    ) THEN
        CREATE POLICY "Users can view own uploaded files"
            ON uploaded_files
            FOR SELECT
            TO authenticated
            USING (user_id = auth.uid());
    END IF;

    -- Policy for users to insert their own files
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'uploaded_files' 
        AND policyname = 'Users can insert own uploaded files'
    ) THEN
        CREATE POLICY "Users can insert own uploaded files"
            ON uploaded_files
            FOR INSERT
            TO authenticated
            WITH CHECK (user_id = auth.uid());
    END IF;

    -- Policy for users to update their own files
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'uploaded_files' 
        AND policyname = 'Users can update own uploaded files'
    ) THEN
        CREATE POLICY "Users can update own uploaded files"
            ON uploaded_files
            FOR UPDATE
            TO authenticated
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;

    -- Policy for users to delete their own files
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'uploaded_files' 
        AND policyname = 'Users can delete own uploaded files'
    ) THEN
        CREATE POLICY "Users can delete own uploaded files"
            ON uploaded_files
            FOR DELETE
            TO authenticated
            USING (user_id = auth.uid());
    END IF;

    -- Policy for admins to access all uploaded files
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'uploaded_files' 
        AND policyname = 'Admins can access all uploaded files'
    ) THEN
        CREATE POLICY "Admins can access all uploaded files"
            ON uploaded_files
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'administrator')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'administrator')
                )
            );
    END IF;

    -- Service role can manage all uploaded files
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'uploaded_files' 
        AND policyname = 'Service role can manage all uploaded files'
    ) THEN
        CREATE POLICY "Service role can manage all uploaded files"
            ON uploaded_files
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Verify and create necessary RLS policies for profiles table
DO $$
BEGIN
    -- Policy for users to view their own profile
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Users can view own profile'
    ) THEN
        CREATE POLICY "Users can view own profile"
            ON profiles
            FOR SELECT
            TO authenticated
            USING (id = auth.uid());
    END IF;

    -- Policy for admins to view all profiles
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Admins can view all profiles'
    ) THEN
        CREATE POLICY "Admins can view all profiles"
            ON profiles
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM profiles p2
                    WHERE p2.id = auth.uid() 
                    AND p2.role IN ('admin', 'administrator')
                )
            );
    END IF;

    -- Service role can manage all profiles
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Service role can manage all profiles'
    ) THEN
        CREATE POLICY "Service role can manage all profiles"
            ON profiles
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Clean up the old private schema approach
-- Drop the private view and related functions
DO $$
BEGIN
    -- Drop private functions first
    BEGIN
        DROP FUNCTION IF EXISTS private.admin_get_file_summary() CASCADE;
        DROP FUNCTION IF EXISTS private.service_get_user_files(uuid) CASCADE;
        DROP FUNCTION IF EXISTS private.verify_file_statistics_setup() CASCADE;
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE 'Some private functions could not be dropped: %', SQLERRM;
    END;

    -- Drop private view
    BEGIN
        DROP VIEW IF EXISTS private.v_file_statistics CASCADE;
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE 'Private view could not be dropped: %', SQLERRM;
    END;

    -- Drop public functions that used SECURITY DEFINER
    BEGIN
        DROP FUNCTION IF EXISTS public.get_file_statistics() CASCADE;
        DROP FUNCTION IF EXISTS public.get_my_file_statistics() CASCADE;
        DROP FUNCTION IF EXISTS public.get_file_statistics_view() CASCADE;
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE 'Some public functions could not be dropped: %', SQLERRM;
    END;
END $$;

-- Create the new SECURITY INVOKER view in the public schema
-- This view will respect RLS policies of the querying user
CREATE OR REPLACE VIEW public.v_file_statistics
WITH (security_invoker = true)
AS
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

-- Grant appropriate permissions on the view
GRANT SELECT ON public.v_file_statistics TO authenticated;
GRANT SELECT ON public.v_file_statistics TO service_role;

-- Add comment to document the security approach
COMMENT ON VIEW public.v_file_statistics IS 'File statistics view with SECURITY INVOKER - respects RLS policies of querying user';

-- Create a helper function for getting user storage usage (for backward compatibility)
-- This function will also respect RLS policies
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
AS $$
    SELECT 
        COALESCE(SUM(total_files), 0)::bigint as total_files,
        COALESCE(SUM(total_size), 0)::numeric as total_size,
        COALESCE(SUM(pgn_files), 0)::bigint as pgn_files,
        COALESCE(SUM(pgn_size), 0)::numeric as pgn_size
    FROM public.v_file_statistics
    WHERE user_id = auth.uid();
$$;

-- Grant execute permission on the storage usage function
GRANT EXECUTE ON FUNCTION public.get_user_storage_usage() TO authenticated;

-- Add comment to document the function
COMMENT ON FUNCTION public.get_user_storage_usage() IS 'Get current user storage usage - respects RLS policies';

-- Create a view for player file statistics (also with SECURITY INVOKER)
CREATE OR REPLACE VIEW public.v_player_file_statistics
WITH (security_invoker = true)
AS
SELECT 
    pf.player_id,
    p.hash as player_hash,
    COUNT(pf.id)::bigint as total_files,
    COALESCE(SUM(pf.file_size), 0)::numeric as total_size,
    COUNT(pf.id) FILTER (WHERE pf.file_type = 'avatar')::bigint as avatar_files,
    COUNT(pf.id) FILTER (WHERE pf.file_type = 'document')::bigint as document_files,
    COUNT(pf.id) FILTER (WHERE pf.file_type = 'analysis')::bigint as analysis_files,
    COUNT(pf.id) FILTER (WHERE pf.is_public = true)::bigint as public_files,
    MAX(pf.created_at) as last_upload
FROM player_files pf
LEFT JOIN players p ON pf.player_id = p.id
GROUP BY pf.player_id, p.hash;

-- Grant appropriate permissions on the player file statistics view
GRANT SELECT ON public.v_player_file_statistics TO authenticated;
GRANT SELECT ON public.v_player_file_statistics TO service_role;

-- Add comment to document the player file statistics view
COMMENT ON VIEW public.v_player_file_statistics IS 'Player file statistics view with SECURITY INVOKER - respects RLS policies';

-- Create a simple admin verification function that respects RLS
CREATE OR REPLACE FUNCTION public.verify_admin_access()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'administrator')
    );
$$;

-- Grant execute permission on the admin verification function
GRANT EXECUTE ON FUNCTION public.verify_admin_access() TO authenticated;

-- Add comment to document the admin verification function
COMMENT ON FUNCTION public.verify_admin_access() IS 'Check if current user has admin privileges - respects RLS policies';

-- Create a function to get comprehensive file statistics (admin only, but still respects RLS)
CREATE OR REPLACE FUNCTION public.get_file_statistics_summary()
RETURNS TABLE (
    total_users_with_files bigint,
    total_files_system bigint,
    total_size_system numeric,
    total_pgn_files bigint,
    total_processed_files bigint,
    total_games_system bigint
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT 
        COUNT(DISTINCT user_id)::bigint as total_users_with_files,
        COALESCE(SUM(total_files), 0)::bigint as total_files_system,
        COALESCE(SUM(total_size), 0)::numeric as total_size_system,
        COALESCE(SUM(pgn_files), 0)::bigint as total_pgn_files,
        COALESCE(SUM(processed_files), 0)::bigint as total_processed_files,
        COALESCE(SUM(total_games), 0)::bigint as total_games_system
    FROM public.v_file_statistics;
$$;

-- Grant execute permission on the summary function
GRANT EXECUTE ON FUNCTION public.get_file_statistics_summary() TO authenticated;

-- Add comment to document the summary function
COMMENT ON FUNCTION public.get_file_statistics_summary() IS 'Get file statistics summary - respects RLS policies (admin users will see all data)';

-- Ensure the private schema is cleaned up properly
DO $$
BEGIN
    -- Remove any remaining objects from private schema related to file statistics
    BEGIN
        -- Drop any remaining views
        DROP VIEW IF EXISTS private.v_file_statistics CASCADE;
        
        -- Drop any remaining functions
        DROP FUNCTION IF EXISTS private.admin_get_file_summary() CASCADE;
        DROP FUNCTION IF EXISTS private.service_get_user_files(uuid) CASCADE;
        DROP FUNCTION IF EXISTS private.verify_file_statistics_setup() CASCADE;
        
        RAISE NOTICE 'Private schema cleanup completed for file statistics';
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE 'Private schema cleanup had some issues (non-critical): %', SQLERRM;
    END;
END $$;

-- Final verification and documentation
DO $$
DECLARE
    view_exists boolean;
    rls_enabled_uploaded boolean;
    rls_enabled_profiles boolean;
    policy_count_uploaded integer;
    policy_count_profiles integer;
BEGIN
    -- Check if the new view exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'v_file_statistics'
    ) INTO view_exists;
    
    -- Check RLS status
    SELECT relrowsecurity INTO rls_enabled_uploaded
    FROM pg_class 
    WHERE relname = 'uploaded_files' AND relnamespace = 'public'::regnamespace;
    
    SELECT relrowsecurity INTO rls_enabled_profiles
    FROM pg_class 
    WHERE relname = 'profiles' AND relnamespace = 'public'::regnamespace;
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count_uploaded
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'uploaded_files';
    
    SELECT COUNT(*) INTO policy_count_profiles
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles';
    
    -- Report status
    RAISE NOTICE '=== File Statistics Security Implementation Complete ===';
    RAISE NOTICE 'View exists: %', view_exists;
    RAISE NOTICE 'RLS enabled on uploaded_files: %', rls_enabled_uploaded;
    RAISE NOTICE 'RLS enabled on profiles: %', rls_enabled_profiles;
    RAISE NOTICE 'Policies on uploaded_files: %', policy_count_uploaded;
    RAISE NOTICE 'Policies on profiles: %', policy_count_profiles;
    RAISE NOTICE '';
    RAISE NOTICE 'Security Model:';
    RAISE NOTICE '- View uses SECURITY INVOKER (respects user permissions)';
    RAISE NOTICE '- RLS policies enforce data access control';
    RAISE NOTICE '- Users see only their own file statistics';
    RAISE NOTICE '- Admins see all file statistics (via RLS policy)';
    RAISE NOTICE '- Service role has full access for system operations';
    RAISE NOTICE '';
    RAISE NOTICE 'Available objects:';
    RAISE NOTICE '- public.v_file_statistics (main view)';
    RAISE NOTICE '- public.v_player_file_statistics (player files)';
    RAISE NOTICE '- public.get_user_storage_usage() (user storage)';
    RAISE NOTICE '- public.get_file_statistics_summary() (admin summary)';
    RAISE NOTICE '- public.verify_admin_access() (admin check)';
END $$;