/*
# Move v_user_management view to private schema

This migration moves the v_user_management view from the public schema to a private schema
for enhanced security. It also creates secure access functions for admin users.

## Changes Made:
1. Create private schema with restricted access
2. Recreate v_user_management view in private schema
3. Create secure access function for admin users
4. Add admin statistics function for service role
5. Implement proper permission controls

## Security Benefits:
- Direct view access restricted to service role only
- Admin access through secure function with role verification
- Complete isolation of sensitive user data
*/

-- Create private schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS private;

-- Grant usage on private schema to service role only
GRANT USAGE ON SCHEMA private TO service_role;

-- Ensure no other roles have access to the private schema
REVOKE ALL ON SCHEMA private FROM public;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

-- Add comment to document the security purpose
COMMENT ON SCHEMA private IS 'Private schema for sensitive views and functions - service role access only';

-- First, let's check if the view exists and handle it properly
DO $$
BEGIN
    -- Drop the existing view from public schema if it exists
    -- We need to handle this carefully to avoid dependency issues
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'v_user_management'
    ) THEN
        DROP VIEW public.v_user_management CASCADE;
    END IF;
END $$;

-- Create the view in the private schema with the same structure
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

-- Add comment to document the view
COMMENT ON VIEW private.v_user_management IS 'User management view with sensitive data - restricted to service role access only';

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
SET search_path = private, public, auth
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

-- Create an additional function for service role operations and statistics
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
SET search_path = private, public, auth
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
COMMENT ON FUNCTION private.admin_get_user_stats() IS 'Admin statistics function - service role access only';

-- Create a helper function for service role to manage users
CREATE OR REPLACE FUNCTION private.service_get_user_by_id(user_id uuid)
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
SET search_path = private, public, auth
AS $$
BEGIN
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
    FROM private.v_user_management v
    WHERE v.id = user_id;
END;
$$;

-- Grant execute permission on the helper function to service role only
GRANT EXECUTE ON FUNCTION private.service_get_user_by_id(uuid) TO service_role;

-- Add comment to document the helper function
COMMENT ON FUNCTION private.service_get_user_by_id(uuid) IS 'Service role function to get specific user data by ID';

-- Ensure all permissions are properly set
-- Revoke any potential permissions from other roles on private schema objects
DO $$
DECLARE
    obj_name text;
BEGIN
    -- Revoke permissions on all objects in private schema from non-service roles
    FOR obj_name IN 
        SELECT schemaname||'.'||tablename 
        FROM pg_tables 
        WHERE schemaname = 'private'
    LOOP
        EXECUTE 'REVOKE ALL ON ' || obj_name || ' FROM public, anon, authenticated';
    END LOOP;
    
    FOR obj_name IN 
        SELECT schemaname||'.'||viewname 
        FROM pg_views 
        WHERE schemaname = 'private'
    LOOP
        EXECUTE 'REVOKE ALL ON ' || obj_name || ' FROM public, anon, authenticated';
    END LOOP;
END $$;

-- Final security verification
-- Ensure the private schema is properly locked down
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM public, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM public, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM public, anon, authenticated;

-- Grant necessary permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA private TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA private TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA private TO service_role;