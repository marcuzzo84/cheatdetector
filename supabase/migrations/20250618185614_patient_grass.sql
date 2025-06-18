/*
  # Fix profiles RLS policy performance issue

  1. Changes
     - Update "Users can view own profile" policy to use subquery for auth.uid()
     - Update "Users can update own profile" policy to use subquery for auth.uid()
     - Update "Users can insert own profile" policy to use subquery for auth.uid()
     - Add comments explaining the performance benefits

  2. Security
     - Maintains same security model
     - Improves query performance by evaluating auth.uid() once per query
*/

-- First, check if the policies exist and drop them if they do
DO $$
BEGIN
    -- Check and drop "Users can view own profile" policy
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Users can view own profile'
    ) THEN
        DROP POLICY "Users can view own profile" ON public.profiles;
    END IF;

    -- Check and drop "Users can update own profile" policy
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Users can update own profile'
    ) THEN
        DROP POLICY "Users can update own profile" ON public.profiles;
    END IF;

    -- Check and drop "Users can insert own profile" policy
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Users can insert own profile'
    ) THEN
        DROP POLICY "Users can insert own profile" ON public.profiles;
    END IF;
END $$;

-- Recreate the policies with optimized subquery approach
-- Policy for users to view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = (SELECT auth.uid()));

-- Policy for users to update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- Policy for users to insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = (SELECT auth.uid()));

-- Add comments to document the optimization
COMMENT ON POLICY "Users can view own profile" ON public.profiles IS 'Allow users to view their own profile - optimized with subquery';
COMMENT ON POLICY "Users can update own profile" ON public.profiles IS 'Allow users to update their own profile - optimized with subquery';
COMMENT ON POLICY "Users can insert own profile" ON public.profiles IS 'Allow users to insert their own profile - optimized with subquery';

-- Document the changes
DO $$
BEGIN
    RAISE NOTICE '=== Profiles RLS Policy Optimization Complete ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Performance Improvements:';
    RAISE NOTICE '- Updated RLS policies to use (SELECT auth.uid()) instead of direct function calls';
    RAISE NOTICE '- This ensures auth.uid() is evaluated only once per query instead of per row';
    RAISE NOTICE '- Significantly improves performance for queries returning multiple rows';
    RAISE NOTICE '- Maintains identical security model and access control';
    RAISE NOTICE '';
    RAISE NOTICE 'Policies Updated:';
    RAISE NOTICE '- "Users can view own profile"';
    RAISE NOTICE '- "Users can update own profile"';
    RAISE NOTICE '- "Users can insert own profile"';
    RAISE NOTICE '';
    RAISE NOTICE 'Best Practices Applied:';
    RAISE NOTICE '- Function evaluation optimization';
    RAISE NOTICE '- Proper policy documentation';
    RAISE NOTICE '- Careful policy replacement to avoid security gaps';
END $$;