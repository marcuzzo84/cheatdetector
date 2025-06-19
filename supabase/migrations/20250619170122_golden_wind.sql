/*
  # Consolidate uploaded_files DELETE policies

  1. Problem
    - Multiple permissive RLS policies for DELETE action on uploaded_files table
    - Each policy must be evaluated for every DELETE query, causing performance overhead
    - Redundant policy conditions that can be consolidated

  2. Solution
    - Drop existing redundant DELETE policies
    - Create single consolidated DELETE policy with comprehensive conditions
    - Maintain same security guarantees with better performance

  3. Security
    - Users can delete their own files (user_id = auth.uid())
    - Admins can delete any files (admin/administrator role check)
    - Service role retains full access
    - No security regression, only performance improvement
*/

-- First, let's see what DELETE policies currently exist
-- (This is for documentation - the actual policies will be dropped and recreated)

-- Drop existing DELETE policies for uploaded_files
DROP POLICY IF EXISTS "Users can delete own uploaded files" ON public.uploaded_files;
DROP POLICY IF EXISTS "Admins can delete all uploaded files" ON public.uploaded_files;
DROP POLICY IF EXISTS "Consolidated delete policy for uploaded files" ON public.uploaded_files;
DROP POLICY IF EXISTS "Allow users to delete own files" ON public.uploaded_files;
DROP POLICY IF EXISTS "Allow admins to delete any files" ON public.uploaded_files;

-- Create a single consolidated DELETE policy that encompasses all previous conditions
CREATE POLICY "consolidated_delete_uploaded_files" ON public.uploaded_files
  FOR DELETE
  TO authenticated
  USING (
    -- Users can delete their own files
    user_id = auth.uid()
    OR
    -- Admins can delete any files
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'administrator')
    )
  );

-- Verify other policies are still in place and optimized
-- Keep existing SELECT policies (they should already be optimized)
-- Keep existing INSERT policies (they should already be optimized)  
-- Keep existing UPDATE policies (they should already be optimized)

-- The service role policy should remain unchanged as it needs full access
-- CREATE POLICY "Service role can manage all uploaded files" ON public.uploaded_files
--   FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add index on user_id if it doesn't exist (for performance)
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id_delete 
  ON public.uploaded_files(user_id) 
  WHERE user_id IS NOT NULL;

-- Add index on profiles.role for admin checks (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_profiles_role_admin 
  ON public.profiles(role) 
  WHERE role IN ('admin', 'administrator');

-- Add comment explaining the consolidation
COMMENT ON POLICY "consolidated_delete_uploaded_files" ON public.uploaded_files IS 
  'Consolidated DELETE policy: users can delete own files OR admins can delete any files. Replaces multiple redundant policies for better performance.';

-- Verify RLS is enabled
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions (should already exist but ensuring they're in place)
GRANT DELETE ON public.uploaded_files TO authenticated;
GRANT ALL ON public.uploaded_files TO service_role;

-- Create a function to verify policy consolidation worked
CREATE OR REPLACE FUNCTION public.verify_uploaded_files_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  policy_count integer;
  delete_policy_count integer;
  result jsonb;
BEGIN
  -- Count total policies on uploaded_files
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'uploaded_files';

  -- Count DELETE policies specifically
  SELECT COUNT(*)
  INTO delete_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'uploaded_files'
    AND cmd = 'DELETE';

  -- Build result
  result := jsonb_build_object(
    'table_name', 'uploaded_files',
    'total_policies', policy_count,
    'delete_policies', delete_policy_count,
    'consolidation_successful', delete_policy_count <= 1,
    'checked_at', now(),
    'recommendation', CASE 
      WHEN delete_policy_count > 1 THEN 'Multiple DELETE policies detected - consider consolidation'
      WHEN delete_policy_count = 1 THEN 'Optimal - single DELETE policy'
      ELSE 'No DELETE policies found - may need to create one'
    END
  );

  RETURN result;
END;
$$;

-- Add comment and permissions for verification function
COMMENT ON FUNCTION public.verify_uploaded_files_policies() IS 'Verification function to check RLS policy consolidation status';
GRANT EXECUTE ON FUNCTION public.verify_uploaded_files_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_uploaded_files_policies() TO service_role;

-- Similarly, let's check and consolidate player_files DELETE policies if needed
-- Drop any redundant DELETE policies for player_files
DROP POLICY IF EXISTS "Users can delete own player files" ON public.player_files;
DROP POLICY IF EXISTS "Admins can delete all player files" ON public.player_files;
DROP POLICY IF EXISTS "Allow users to delete own player files" ON public.player_files;
DROP POLICY IF EXISTS "Allow admins to delete any player files" ON public.player_files;

-- Create consolidated DELETE policy for player_files (if it doesn't already exist optimally)
CREATE POLICY "consolidated_delete_player_files" ON public.player_files
  FOR DELETE
  TO authenticated
  USING (
    -- Users can delete their own files
    user_id = auth.uid()
    OR
    -- Admins can delete any files
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'administrator')
    )
  );

-- Add performance indexes for player_files if they don't exist
CREATE INDEX IF NOT EXISTS idx_player_files_user_id_delete 
  ON public.player_files(user_id) 
  WHERE user_id IS NOT NULL;

-- Add comment for player_files policy
COMMENT ON POLICY "consolidated_delete_player_files" ON public.player_files IS 
  'Consolidated DELETE policy: users can delete own files OR admins can delete any files. Optimized for performance.';

-- Ensure RLS is enabled on player_files
ALTER TABLE public.player_files ENABLE ROW LEVEL SECURITY;

-- Create verification function for player_files as well
CREATE OR REPLACE FUNCTION public.verify_player_files_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  policy_count integer;
  delete_policy_count integer;
  result jsonb;
BEGIN
  -- Count total policies on player_files
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'player_files';

  -- Count DELETE policies specifically
  SELECT COUNT(*)
  INTO delete_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'player_files'
    AND cmd = 'DELETE';

  -- Build result
  result := jsonb_build_object(
    'table_name', 'player_files',
    'total_policies', policy_count,
    'delete_policies', delete_policy_count,
    'consolidation_successful', delete_policy_count <= 1,
    'checked_at', now(),
    'recommendation', CASE 
      WHEN delete_policy_count > 1 THEN 'Multiple DELETE policies detected - consider consolidation'
      WHEN delete_policy_count = 1 THEN 'Optimal - single DELETE policy'
      ELSE 'No DELETE policies found - may need to create one'
    END
  );

  RETURN result;
END;
$$;

-- Add comment and permissions for player_files verification function
COMMENT ON FUNCTION public.verify_player_files_policies() IS 'Verification function to check player_files RLS policy consolidation status';
GRANT EXECUTE ON FUNCTION public.verify_player_files_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_player_files_policies() TO service_role;

-- Create a comprehensive function to check all table policy optimizations
CREATE OR REPLACE FUNCTION public.verify_all_rls_optimizations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  uploaded_files_result jsonb;
  player_files_result jsonb;
  overall_result jsonb;
  total_issues integer := 0;
BEGIN
  -- Check uploaded_files policies
  SELECT public.verify_uploaded_files_policies() INTO uploaded_files_result;
  
  -- Check player_files policies
  SELECT public.verify_player_files_policies() INTO player_files_result;
  
  -- Count issues
  IF (uploaded_files_result->>'delete_policies')::integer > 1 THEN
    total_issues := total_issues + 1;
  END IF;
  
  IF (player_files_result->>'delete_policies')::integer > 1 THEN
    total_issues := total_issues + 1;
  END IF;
  
  -- Build comprehensive result
  overall_result := jsonb_build_object(
    'optimization_check', 'complete',
    'checked_at', now(),
    'total_issues_found', total_issues,
    'optimization_status', CASE 
      WHEN total_issues = 0 THEN 'optimal'
      ELSE 'needs_attention'
    END,
    'tables_checked', jsonb_build_object(
      'uploaded_files', uploaded_files_result,
      'player_files', player_files_result
    ),
    'recommendations', CASE 
      WHEN total_issues = 0 THEN jsonb_build_array('All RLS policies are optimally consolidated')
      ELSE jsonb_build_array('Some tables have multiple DELETE policies that should be consolidated for better performance')
    END
  );
  
  RETURN overall_result;
END;
$$;

-- Add comment and permissions for comprehensive verification function
COMMENT ON FUNCTION public.verify_all_rls_optimizations() IS 'Comprehensive function to verify RLS policy optimizations across all tables';
GRANT EXECUTE ON FUNCTION public.verify_all_rls_optimizations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_all_rls_optimizations() TO service_role;