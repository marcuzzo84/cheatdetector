/*
  # Move v_user_management view to private schema

  1. Schema Changes
    - Create `private` schema if it doesn't exist
    - Move `v_user_management` view from `public` to `private` schema
    - Update RLS policies and permissions

  2. Security Improvements
    - Restrict access to private schema
    - Ensure only service role can access the view
    - Remove public access to sensitive user data

  3. Access Control
    - Grant appropriate permissions to service role
    - Revoke public access to the view
*/

-- Create private schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS private;

-- Grant usage on private schema to service role
GRANT USAGE ON SCHEMA private TO service_role;

-- Drop the existing view from public schema if it exists
DROP VIEW IF EXISTS public.v_user_management;

-- Create the view in the private schema
CREATE OR REPLACE VIEW private.v_user_management AS
SELECT 
    u.id,
    p.full_name,
    u.email,
    p.role,
    p.created_at,
    p.updated_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    CASE 
        WHEN u.email_confirmed_at IS NOT NULL THEN 'confirmed'
        WHEN u.created_at > NOW() - INTERVAL '24 hours' THEN 'pending'
        ELSE 'unconfirmed'
    END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.deleted_at IS NULL
ORDER BY p.created_at DESC;

-- Grant select permission on the view to service role only
GRANT SELECT ON private.v_user_management TO service_role;

-- Ensure no other roles have access to the private schema
REVOKE ALL ON SCHEMA private FROM public;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

-- Add comment to document the security purpose
COMMENT ON SCHEMA private IS 'Private schema for sensitive views and functions - service role access only';
COMMENT ON VIEW private.v_user_management IS 'User management view with sensitive data - restricted to service role';

-- Create a secure function for admins to access user management data
CREATE OR REPLACE FUNCTION public.get_user_management_data()
RETURNS TABLE (
    id uuid,
    full_name text,
    email varchar(255),
    role text,
    created_at timestamptz,
    updated_at timestamptz,
    last_sign_in_at timestamptz,
    email_confirmed_at timestamptz,
    status text
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
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    -- Return data from the private view
    RETURN QUERY
    SELECT 
        v.id,
        v.full_name,
        v.email,
        v.role,
        v.created_at,
        v.updated_at,
        v.last_sign_in_at,
        v.email_confirmed_at,
        v.status
    FROM private.v_user_management v;
END;
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_management_data() TO authenticated;

-- Add comment to document the function
COMMENT ON FUNCTION public.get_user_management_data() IS 'Secure function to access user management data - requires admin privileges';

-- Create an additional function for service role operations
CREATE OR REPLACE FUNCTION private.admin_get_user_stats()
RETURNS TABLE (
    total_users bigint,
    confirmed_users bigint,
    pending_users bigint,
    admin_users bigint,
    recent_signups bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::bigint as total_users,
        COUNT(*) FILTER (WHERE status = 'confirmed')::bigint as confirmed_users,
        COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_users,
        COUNT(*) FILTER (WHERE role IN ('admin', 'administrator'))::bigint as admin_users,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::bigint as recent_signups
    FROM private.v_user_management;
END;
$$;

-- Grant execute permission on the stats function to service role only
GRANT EXECUTE ON FUNCTION private.admin_get_user_stats() TO service_role;

-- Add comment to document the stats function
COMMENT ON FUNCTION private.admin_get_user_stats() IS 'Admin statistics function - service role only';