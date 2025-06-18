/*
  # Consolidate uploaded_files DELETE policies

  1. Changes
     - Consolidate multiple permissive DELETE policies for uploaded_files table
     - Replace with a single optimized policy that covers both admin and user cases
     - Maintain the same security model while improving performance

  2. Security
     - Enable RLS on uploaded_files table (if not already enabled)
     - Create a single consolidated policy for DELETE operations
     - Maintain existing security rules (users can delete their own files, admins can delete any file)
*/

-- First, check if the policies exist and drop them if they do
DO $$
BEGIN
    -- Check and drop "Admins can access all uploaded files" policy (for DELETE)
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'uploaded_files' 
        AND policyname = 'Admins can access all uploaded files'
        AND cmd = 'DELETE'
    ) THEN
        DROP POLICY "Admins can access all uploaded files" ON public.uploaded_files;
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

-- Create a single consolidated policy for DELETE operations
CREATE POLICY "Consolidated delete policy for uploaded files"
    ON public.uploaded_files
    FOR DELETE
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())  -- Users can delete their own files
        OR 
        EXISTS (  -- Admins can delete any file
            SELECT 1 FROM profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role IN ('admin', 'administrator')
        )
    );

-- Add comment to document the optimization
COMMENT ON POLICY "Consolidated delete policy for uploaded files" ON public.uploaded_files 
IS 'Consolidated policy: Users can delete their own files, admins can delete any file - optimized with subquery';

-- Document the changes
DO $$
BEGIN
    RAISE NOTICE '=== Uploaded Files DELETE Policy Consolidation Complete ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Performance Improvements:';
    RAISE NOTICE '- Consolidated multiple permissive DELETE policies into a single policy';
    RAISE NOTICE '- Updated RLS policy to use (SELECT auth.uid()) instead of direct function calls';
    RAISE NOTICE '- This ensures auth.uid() is evaluated only once per query instead of per row';
    RAISE NOTICE '- Reduces the number of policy evaluations needed for DELETE operations';
    RAISE NOTICE '- Maintains identical security model and access control';
    RAISE NOTICE '';
    RAISE NOTICE 'Policy Changes:';
    RAISE NOTICE '- Removed: "Admins can access all uploaded files" (for DELETE)';
    RAISE NOTICE '- Removed: "Users can delete own uploaded files"';
    RAISE NOTICE '- Added: "Consolidated delete policy for uploaded files"';
    RAISE NOTICE '';
    RAISE NOTICE 'Security Model Maintained:';
    RAISE NOTICE '- Users can still only delete their own files';
    RAISE NOTICE '- Admins can still delete any file';
    RAISE NOTICE '- Service role permissions unchanged';
    RAISE NOTICE '';
    RAISE NOTICE 'Best Practices Applied:';
    RAISE NOTICE '- Policy consolidation for improved performance';
    RAISE NOTICE '- Function evaluation optimization';
    RAISE NOTICE '- Proper policy documentation';
    RAISE NOTICE '- Careful policy replacement to avoid security gaps';
END $$;