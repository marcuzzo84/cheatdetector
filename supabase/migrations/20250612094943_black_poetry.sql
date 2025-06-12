-- Add role-based access control to the profiles table

-- 1. Update the profiles table to ensure role column has proper constraints
DO $$
BEGIN
  -- Add check constraint for valid roles if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('user', 'admin', 'administrator', 'moderator'));
  END IF;
END $$;

-- 2. Update default role to 'user' for new signups
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'user';

-- 3. Create function to handle new user registration with default role
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user'  -- Default role for new users
  );
  RETURN NEW;
END;
$$;

-- 4. Create trigger for new user registration (drop if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. Update existing users without profiles to have 'user' role
INSERT INTO profiles (id, full_name, role)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  'user'
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- 6. Ensure the demo admin user exists with admin role
DO $$
BEGIN
  -- Check if admin user exists, if not create a profile for them
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = 'admin@fairplay-scout.com'
  ) THEN
    -- Update existing admin user to have admin role
    UPDATE profiles 
    SET role = 'admin'
    WHERE id = (
      SELECT id FROM auth.users 
      WHERE email = 'admin@fairplay-scout.com'
    );
  END IF;
END $$;

-- 7. Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role IN ('admin', 'administrator')
  );
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO service_role;

-- 8. Create function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(role, 'user') 
  FROM profiles 
  WHERE id = user_id;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO service_role;

-- 9. Update RLS policies to be more specific about admin access
-- Note: Most tables already have proper RLS, but we can add admin-specific policies if needed

-- 10. Add comments for documentation
COMMENT ON COLUMN profiles.role IS 'User role: user, admin, administrator, or moderator';
COMMENT ON FUNCTION is_admin(uuid) IS 'Check if a user has admin privileges';
COMMENT ON FUNCTION get_user_role(uuid) IS 'Get the role of a user';
COMMENT ON FUNCTION handle_new_user() IS 'Automatically create profile for new users with default role';

-- 11. Create view for user management (admin only)
CREATE OR REPLACE VIEW v_user_management AS
SELECT 
  p.id,
  p.full_name,
  au.email,
  p.role,
  p.created_at,
  p.updated_at,
  au.last_sign_in_at,
  au.email_confirmed_at,
  CASE 
    WHEN au.last_sign_in_at > now() - interval '30 days' THEN 'active'
    WHEN au.last_sign_in_at > now() - interval '90 days' THEN 'inactive'
    ELSE 'dormant'
  END as status
FROM profiles p
JOIN auth.users au ON au.id = p.id
ORDER BY p.created_at DESC;

-- Grant access to admin users only (this would be enforced in the application layer)
GRANT SELECT ON v_user_management TO service_role;

-- 12. Add index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 13. Create function to promote user to admin (for initial setup)
CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id uuid;
BEGIN
  -- Get user ID from email
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Update user role to admin
  UPDATE profiles
  SET role = 'admin', updated_at = now()
  WHERE id = user_id;
  
  RETURN true;
END;
$$;

-- Grant to service role only (for administrative operations)
GRANT EXECUTE ON FUNCTION promote_user_to_admin(text) TO service_role;