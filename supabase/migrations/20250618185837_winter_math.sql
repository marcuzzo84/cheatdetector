/*
  # Fix uploaded_files RLS policy performance

  1. Changes
     - Replace direct auth.uid() calls with (SELECT auth.uid()) in RLS policies
     - This optimization ensures the function is evaluated only once per query instead of per row
     - Maintains identical security model and access control

  2. Security
     - No change to security model, only performance optimization
     - All existing permissions remain the same
*/

-- First, check if the policies exist and drop them if they do
DO $$
BEGIN
    -- Check and drop "Users can view own uploaded files" policy
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'uploaded_files' 
        AND policyname = 'Users can view own uploaded files'
    ) THEN
        DROP POLICY "Users can view own uploaded files" ON public.uploaded_files;
    END IF;

    -- Check and drop "Users can update own uploaded files" policy
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'uploaded_files' 
        AND policyname = 'Users can update own uploaded files'
    ) THEN
        DROP POLICY "Users can update own uploaded files" ON public.uploaded_files;
    END IF;

    -- Check and drop "Users can insert own uploaded files" policy
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'uploaded_files' 
        AND policyname = 'Users can insert own uploaded files'
    ) THEN
        DROP POLICY "Users can insert own uploaded files" ON public.uploaded_files;
    END IF;

    -- Check and drop "Users can delete own uploaded files" policy
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'uploaded_files' 
        AND policyname = 'Users can delete own uploaded files'
    ) THEN
        DROP POLICY "Users can delete own uploaded files" ON public.uploaded_files;
    END IF;
END $$;

-- Recreate the policies with optimized subquery approach
-- Policy for users to view their own uploaded files
CREATE POLICY "Users can view own uploaded files"
    ON public.uploaded_files
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Policy for users to update their own uploaded files
CREATE POLICY "Users can update own uploaded files"
    ON public.uploaded_files
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Policy for users to insert their own uploaded files
CREATE POLICY "Users can insert own uploaded files"
    ON public.uploaded_files
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Policy for users to delete their own uploaded files
CREATE POLICY "Users can delete own uploaded files"
    ON public.uploaded_files
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Add comments to document the optimization
COMMENT ON POLICY "Users can view own uploaded files" ON public.uploaded_files IS 'Allow users to view their own uploaded files - optimized with subquery';
COMMENT ON POLICY "Users can update own uploaded files" ON public.uploaded_files IS 'Allow users to update their own uploaded files - optimized with subquery';
COMMENT ON POLICY "Users can insert own uploaded files" ON public.uploaded_files IS 'Allow users to insert their own uploaded files - optimized with subquery';
COMMENT ON POLICY "Users can delete own uploaded files" ON public.uploaded_files IS 'Allow users to delete their own uploaded files - optimized with subquery';

-- Document the changes
DO $$
BEGIN
    RAISE NOTICE '=== Uploaded Files RLS Policy Optimization Complete ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Performance Improvements:';
    RAISE NOTICE '- Updated RLS policies to use (SELECT auth.uid()) instead of direct function calls';
    RAISE NOTICE '- This ensures auth.uid() is evaluated only once per query instead of per row';
    RAISE NOTICE '- Significantly improves performance for queries returning multiple rows';
    RAISE NOTICE '- Maintains identical security model and access control';
    RAISE NOTICE '';
    RAISE NOTICE 'Policies Updated:';
    RAISE NOTICE '- "Users can view own uploaded files"';
    RAISE NOTICE '- "Users can update own uploaded files"';
    RAISE NOTICE '- "Users can insert own uploaded files"';
    RAISE NOTICE '- "Users can delete own uploaded files"';
    RAISE NOTICE '';
    RAISE NOTICE 'Best Practices Applied:';
    RAISE NOTICE '- Function evaluation optimization';
    RAISE NOTICE '- Proper policy documentation';
    RAISE NOTICE '- Careful policy replacement to avoid security gaps';
END $$;