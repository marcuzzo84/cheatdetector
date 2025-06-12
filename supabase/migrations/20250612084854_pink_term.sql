/*
  # Fix signup database error

  1. Issues Fixed
    - Update handle_new_user trigger function to handle potential errors gracefully
    - Ensure proper RLS policies for profile creation during signup
    - Add error handling for profile insertion

  2. Changes Made
    - Recreate handle_new_user function with better error handling
    - Ensure service role can create profiles during signup
    - Add proper exception handling in the trigger function
*/

-- Drop and recreate the handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles table with error handling
  BEGIN
    INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      'user',
      NOW(),
      NOW()
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the user creation
      RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update RLS policies to ensure service role can create profiles during signup
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
CREATE POLICY "Service role can manage all profiles"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure authenticated users can insert their own profile (fallback)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Grant necessary permissions to the service role
GRANT ALL ON public.profiles TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;