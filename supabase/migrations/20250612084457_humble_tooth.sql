/*
  # Authentication Setup

  1. Security
    - Enable RLS on auth.users (already enabled by default)
    - Create policies for user management
    - Set up user profiles table

  2. User Profiles
    - Create profiles table linked to auth.users
    - Add triggers for automatic profile creation
    - Set up proper permissions

  3. Functions
    - Create helper functions for user management
    - Add functions for profile updates
*/

-- Create profiles table to extend auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user'
  );
  RETURN NEW;
END;
$$;

-- Trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to update updated_at on profile changes
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;

-- Create function to get user profile with auth info
CREATE OR REPLACE FUNCTION get_user_profile(user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role text,
  created_at timestamptz,
  updated_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    u.email,
    p.full_name,
    p.avatar_url,
    p.role,
    p.created_at,
    p.updated_at,
    u.last_sign_in_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = user_id;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_user_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_profile(uuid) TO service_role;

-- Insert default admin profile if it doesn't exist
DO $$
BEGIN
  -- Check if admin user exists, if not create a demo profile
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN
    -- This is just for demo purposes - in production, admin users should be created properly
    INSERT INTO profiles (id, full_name, role)
    SELECT 
      gen_random_uuid(),
      'Demo Admin',
      'admin'
    WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin');
  END IF;
END $$;