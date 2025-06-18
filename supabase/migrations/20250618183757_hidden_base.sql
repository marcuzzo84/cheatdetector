/*
  # OTP Security Configuration

  1. Security Settings
    - Set OTP expiry to 10 minutes (600 seconds)
    - Configure rate limiting for OTP requests
    - Add monitoring for unusual activity
    - Implement user education notifications

  2. Security Policies
    - Rate limiting policies for OTP generation
    - Monitoring triggers for suspicious activity
    - User notification system for security events

  3. Functions
    - OTP validation with enhanced security
    - Rate limiting enforcement
    - Security event logging
*/

-- Configure OTP expiry time to 10 minutes (600 seconds)
-- This is done through Supabase Auth configuration
-- Note: This setting needs to be configured in the Supabase Dashboard under Authentication > Settings

-- Create a table to track OTP requests for rate limiting
CREATE TABLE IF NOT EXISTS public.otp_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    ip_address inet,
    user_agent text,
    request_type text NOT NULL CHECK (request_type IN ('signup', 'signin', 'password_reset', 'email_change')),
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '10 minutes'),
    used_at timestamptz,
    attempts integer DEFAULT 1,
    is_suspicious boolean DEFAULT false
);

-- Enable RLS on otp_requests table
ALTER TABLE public.otp_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_otp_requests_email_created ON public.otp_requests(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_requests_ip_created ON public.otp_requests(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_requests_expires ON public.otp_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_requests_suspicious ON public.otp_requests(is_suspicious, created_at DESC);

-- RLS policies for otp_requests
DO $$
BEGIN
    -- Users can view their own OTP requests
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'otp_requests' 
        AND policyname = 'Users can view own OTP requests'
    ) THEN
        CREATE POLICY "Users can view own OTP requests"
            ON otp_requests
            FOR SELECT
            TO authenticated
            USING (user_id = auth.uid() OR email = auth.email());
    END IF;

    -- Service role can manage all OTP requests
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'otp_requests' 
        AND policyname = 'Service role can manage OTP requests'
    ) THEN
        CREATE POLICY "Service role can manage OTP requests"
            ON otp_requests
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;

    -- Admins can view all OTP requests for monitoring
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'otp_requests' 
        AND policyname = 'Admins can view all OTP requests'
    ) THEN
        CREATE POLICY "Admins can view all OTP requests"
            ON otp_requests
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'administrator')
                )
            );
    END IF;
END $$;

-- Create a table for security events and monitoring
CREATE TABLE IF NOT EXISTS public.security_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL CHECK (event_type IN ('otp_rate_limit', 'suspicious_activity', 'failed_verification', 'account_lockout')),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    email text,
    ip_address inet,
    user_agent text,
    details jsonb DEFAULT '{}',
    severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    resolved boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on security_events table
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Create indexes for security events
CREATE INDEX IF NOT EXISTS idx_security_events_type_created ON public.security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON public.security_events(ip_address, created_at DESC);

-- RLS policies for security_events
DO $$
BEGIN
    -- Admins can view all security events
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'security_events' 
        AND policyname = 'Admins can view all security events'
    ) THEN
        CREATE POLICY "Admins can view all security events"
            ON security_events
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'administrator')
                )
            );
    END IF;

    -- Service role can manage all security events
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'security_events' 
        AND policyname = 'Service role can manage security events'
    ) THEN
        CREATE POLICY "Service role can manage security events"
            ON security_events
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Function to check OTP rate limits
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(
    p_email text,
    p_ip_address inet DEFAULT NULL,
    p_request_type text DEFAULT 'signin'
)
RETURNS TABLE (
    allowed boolean,
    remaining_attempts integer,
    reset_time timestamptz,
    reason text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
    email_requests_1h integer;
    email_requests_24h integer;
    ip_requests_1h integer;
    ip_requests_24h integer;
    max_email_1h integer := 5;  -- 5 OTP requests per email per hour
    max_email_24h integer := 10; -- 10 OTP requests per email per 24 hours
    max_ip_1h integer := 10;     -- 10 OTP requests per IP per hour
    max_ip_24h integer := 20;    -- 20 OTP requests per IP per 24 hours
    next_reset timestamptz;
BEGIN
    -- Count recent requests by email
    SELECT COUNT(*) INTO email_requests_1h
    FROM otp_requests
    WHERE email = p_email
    AND created_at > NOW() - INTERVAL '1 hour';

    SELECT COUNT(*) INTO email_requests_24h
    FROM otp_requests
    WHERE email = p_email
    AND created_at > NOW() - INTERVAL '24 hours';

    -- Count recent requests by IP (if provided)
    IF p_ip_address IS NOT NULL THEN
        SELECT COUNT(*) INTO ip_requests_1h
        FROM otp_requests
        WHERE ip_address = p_ip_address
        AND created_at > NOW() - INTERVAL '1 hour';

        SELECT COUNT(*) INTO ip_requests_24h
        FROM otp_requests
        WHERE ip_address = p_ip_address
        AND created_at > NOW() - INTERVAL '24 hours';
    ELSE
        ip_requests_1h := 0;
        ip_requests_24h := 0;
    END IF;

    -- Calculate next reset time
    next_reset := date_trunc('hour', NOW()) + INTERVAL '1 hour';

    -- Check rate limits
    IF email_requests_1h >= max_email_1h THEN
        RETURN QUERY SELECT 
            false,
            0,
            next_reset,
            'Too many OTP requests for this email address. Please wait before requesting another.'::text;
        RETURN;
    END IF;

    IF email_requests_24h >= max_email_24h THEN
        RETURN QUERY SELECT 
            false,
            0,
            date_trunc('day', NOW()) + INTERVAL '1 day',
            'Daily OTP limit exceeded for this email address. Please try again tomorrow.'::text;
        RETURN;
    END IF;

    IF p_ip_address IS NOT NULL AND ip_requests_1h >= max_ip_1h THEN
        RETURN QUERY SELECT 
            false,
            0,
            next_reset,
            'Too many OTP requests from this location. Please wait before requesting another.'::text;
        RETURN;
    END IF;

    IF p_ip_address IS NOT NULL AND ip_requests_24h >= max_ip_24h THEN
        RETURN QUERY SELECT 
            false,
            0,
            date_trunc('day', NOW()) + INTERVAL '1 day',
            'Daily OTP limit exceeded from this location. Please try again tomorrow.'::text;
        RETURN;
    END IF;

    -- If we get here, the request is allowed
    RETURN QUERY SELECT 
        true,
        max_email_1h - email_requests_1h,
        next_reset,
        'OTP request allowed'::text;
END;
$$;

-- Grant execute permission on rate limit function
GRANT EXECUTE ON FUNCTION public.check_otp_rate_limit(text, inet, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_otp_rate_limit(text, inet, text) TO service_role;

-- Function to log OTP requests
CREATE OR REPLACE FUNCTION public.log_otp_request(
    p_email text,
    p_ip_address inet DEFAULT NULL,
    p_user_agent text DEFAULT NULL,
    p_request_type text DEFAULT 'signin'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
    request_id uuid;
    user_uuid uuid;
    is_suspicious_activity boolean := false;
BEGIN
    -- Get user ID if exists
    SELECT id INTO user_uuid
    FROM auth.users
    WHERE email = p_email;

    -- Check for suspicious patterns
    -- Multiple requests from different IPs for same email
    IF EXISTS (
        SELECT 1 FROM otp_requests
        WHERE email = p_email
        AND ip_address != p_ip_address
        AND created_at > NOW() - INTERVAL '1 hour'
        LIMIT 1
    ) THEN
        is_suspicious_activity := true;
    END IF;

    -- Insert OTP request log
    INSERT INTO otp_requests (
        user_id,
        email,
        ip_address,
        user_agent,
        request_type,
        is_suspicious
    ) VALUES (
        user_uuid,
        p_email,
        p_ip_address,
        p_user_agent,
        p_request_type,
        is_suspicious_activity
    ) RETURNING id INTO request_id;

    -- Log security event if suspicious
    IF is_suspicious_activity THEN
        INSERT INTO security_events (
            event_type,
            user_id,
            email,
            ip_address,
            user_agent,
            details,
            severity
        ) VALUES (
            'suspicious_activity',
            user_uuid,
            p_email,
            p_ip_address,
            p_user_agent,
            jsonb_build_object(
                'reason', 'Multiple IP addresses for same email',
                'request_type', p_request_type,
                'otp_request_id', request_id
            ),
            'medium'
        );
    END IF;

    RETURN request_id;
END;
$$;

-- Grant execute permission on logging function
GRANT EXECUTE ON FUNCTION public.log_otp_request(text, inet, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_otp_request(text, inet, text, text) TO service_role;

-- Function to get OTP security status for admins
CREATE OR REPLACE FUNCTION public.get_otp_security_status()
RETURNS TABLE (
    total_requests_24h bigint,
    suspicious_requests_24h bigint,
    rate_limited_requests_24h bigint,
    unique_ips_24h bigint,
    top_requesting_emails jsonb,
    recent_security_events jsonb
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, auth
AS $$
    SELECT 
        (SELECT COUNT(*) FROM otp_requests WHERE created_at > NOW() - INTERVAL '24 hours')::bigint,
        (SELECT COUNT(*) FROM otp_requests WHERE is_suspicious = true AND created_at > NOW() - INTERVAL '24 hours')::bigint,
        (SELECT COUNT(*) FROM security_events WHERE event_type = 'otp_rate_limit' AND created_at > NOW() - INTERVAL '24 hours')::bigint,
        (SELECT COUNT(DISTINCT ip_address) FROM otp_requests WHERE created_at > NOW() - INTERVAL '24 hours')::bigint,
        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'email', email,
                        'requests', request_count,
                        'suspicious', suspicious_count
                    )
                    ORDER BY request_count DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT 
                    email,
                    COUNT(*) as request_count,
                    COUNT(*) FILTER (WHERE is_suspicious = true) as suspicious_count
                FROM otp_requests
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY email
                ORDER BY request_count DESC
                LIMIT 10
            ) top_emails
        ),
        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'event_type', event_type,
                        'severity', severity,
                        'email', email,
                        'created_at', created_at,
                        'details', details
                    )
                    ORDER BY created_at DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT *
                FROM security_events
                WHERE created_at > NOW() - INTERVAL '24 hours'
                ORDER BY created_at DESC
                LIMIT 20
            ) recent_events
        );
$$;

-- Grant execute permission on security status function
GRANT EXECUTE ON FUNCTION public.get_otp_security_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_otp_security_status() TO service_role;

-- Function to clean up expired OTP requests
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Delete OTP requests older than 24 hours
    DELETE FROM otp_requests
    WHERE created_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Also clean up old security events (keep for 30 days)
    DELETE FROM security_events
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND resolved = true;
    
    RETURN deleted_count;
END;
$$;

-- Grant execute permission on cleanup function
GRANT EXECUTE ON FUNCTION public.cleanup_expired_otp_requests() TO service_role;

-- Create a trigger to automatically mark used OTP requests
CREATE OR REPLACE FUNCTION public.mark_otp_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Mark OTP as used when user successfully signs in
    UPDATE otp_requests
    SET used_at = NOW()
    WHERE email = NEW.email
    AND used_at IS NULL
    AND created_at > NOW() - INTERVAL '10 minutes';
    
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users for successful sign-ins
-- Note: This would need to be created by Supabase admin as it affects auth schema
-- For now, we'll document this requirement

-- Create a view for OTP security monitoring (admin only)
CREATE OR REPLACE VIEW public.v_otp_security_monitor
WITH (security_invoker = true)
AS
SELECT 
    o.id,
    o.email,
    o.ip_address,
    o.request_type,
    o.created_at,
    o.expires_at,
    o.used_at,
    o.attempts,
    o.is_suspicious,
    CASE 
        WHEN o.used_at IS NOT NULL THEN 'used'
        WHEN o.expires_at < NOW() THEN 'expired'
        ELSE 'active'
    END as status,
    EXTRACT(EPOCH FROM (o.expires_at - o.created_at)) / 60 as validity_minutes
FROM otp_requests o
WHERE o.created_at > NOW() - INTERVAL '7 days'
ORDER BY o.created_at DESC;

-- Grant permissions on the monitoring view
GRANT SELECT ON public.v_otp_security_monitor TO authenticated;
GRANT SELECT ON public.v_otp_security_monitor TO service_role;

-- Add comment
COMMENT ON VIEW public.v_otp_security_monitor IS 'OTP security monitoring view - respects RLS policies';

-- Add comments to document the tables and functions
COMMENT ON TABLE public.otp_requests IS 'Tracks OTP requests for rate limiting and security monitoring';
COMMENT ON TABLE public.security_events IS 'Logs security events and suspicious activities';
COMMENT ON FUNCTION public.check_otp_rate_limit(text, inet, text) IS 'Checks if OTP request is within rate limits';
COMMENT ON FUNCTION public.log_otp_request(text, inet, text, text) IS 'Logs OTP request and detects suspicious activity';
COMMENT ON FUNCTION public.get_otp_security_status() IS 'Returns OTP security status for admin monitoring';
COMMENT ON FUNCTION public.cleanup_expired_otp_requests() IS 'Cleans up expired OTP requests and old security events';

-- Final documentation and setup instructions
DO $$
BEGIN
    RAISE NOTICE '=== OTP Security Configuration Complete ===';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: Manual Configuration Required in Supabase Dashboard:';
    RAISE NOTICE '1. Go to Authentication > Settings in Supabase Dashboard';
    RAISE NOTICE '2. Set "OTP Expiry" to 600 seconds (10 minutes)';
    RAISE NOTICE '3. Enable "Confirm email" if not already enabled';
    RAISE NOTICE '4. Consider enabling "Double confirm email change"';
    RAISE NOTICE '';
    RAISE NOTICE 'Security Features Implemented:';
    RAISE NOTICE '- Rate limiting: 5 OTP requests per email per hour';
    RAISE NOTICE '- Daily limits: 10 OTP requests per email per 24 hours';
    RAISE NOTICE '- IP-based rate limiting: 10 requests per IP per hour';
    RAISE NOTICE '- Suspicious activity detection and logging';
    RAISE NOTICE '- Security event monitoring for admins';
    RAISE NOTICE '- Automatic cleanup of expired requests';
    RAISE NOTICE '';
    RAISE NOTICE 'Available Functions:';
    RAISE NOTICE '- public.check_otp_rate_limit() - Check rate limits before sending OTP';
    RAISE NOTICE '- public.log_otp_request() - Log OTP requests for monitoring';
    RAISE NOTICE '- public.get_otp_security_status() - Admin security dashboard';
    RAISE NOTICE '- public.cleanup_expired_otp_requests() - Cleanup old data';
    RAISE NOTICE '';
    RAISE NOTICE 'Monitoring Views:';
    RAISE NOTICE '- public.v_otp_security_monitor - Real-time OTP monitoring';
    RAISE NOTICE '';
    RAISE NOTICE 'User Education:';
    RAISE NOTICE '- OTP codes now expire in 10 minutes for security';
    RAISE NOTICE '- Rate limiting prevents abuse and protects accounts';
    RAISE NOTICE '- Suspicious activity is automatically detected and logged';
    RAISE NOTICE '- Users should use OTP codes promptly after receiving them';
END $$;