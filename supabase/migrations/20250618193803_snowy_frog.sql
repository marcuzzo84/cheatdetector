/*
  # Add index to otp_requests.user_id foreign key

  1. New Indexes
    - `idx_otp_requests_user_id` on `otp_requests.user_id` column
  
  2. Performance Improvements
    - Speeds up queries that join otp_requests with users table
    - Improves performance of foreign key constraint checks
    - Enhances query performance for user-specific OTP request lookups
*/

-- Check if the index already exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'otp_requests' 
    AND indexname = 'idx_otp_requests_user_id'
  ) THEN
    -- Create the index on the foreign key column
    CREATE INDEX idx_otp_requests_user_id ON public.otp_requests(user_id);
    
    RAISE NOTICE 'Created index idx_otp_requests_user_id on otp_requests.user_id';
  ELSE
    RAISE NOTICE 'Index idx_otp_requests_user_id already exists on otp_requests.user_id';
  END IF;
END $$;

-- Add comment to document the index purpose
COMMENT ON INDEX public.idx_otp_requests_user_id IS 'Improves performance for queries involving the foreign key relationship between otp_requests and auth.users';

-- Document the performance improvement
DO $$
BEGIN
  RAISE NOTICE '=== Foreign Key Index Added to otp_requests.user_id ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Performance Benefits:';
  RAISE NOTICE '- Faster JOIN operations between otp_requests and users tables';
  RAISE NOTICE '- Improved performance for foreign key constraint validation';
  RAISE NOTICE '- More efficient queries filtering by user_id';
  RAISE NOTICE '- Better overall query performance for user-specific OTP operations';
  RAISE NOTICE '';
  RAISE NOTICE 'Use Cases Improved:';
  RAISE NOTICE '- User authentication history lookups';
  RAISE NOTICE '- Security monitoring and auditing';
  RAISE NOTICE '- User-specific rate limit enforcement';
  RAISE NOTICE '';
  RAISE NOTICE 'Index Details:';
  RAISE NOTICE '- Index Type: B-tree (default)';
  RAISE NOTICE '- Column: user_id';
  RAISE NOTICE '- Table: otp_requests';
  RAISE NOTICE '- Foreign Key Reference: auth.users(id)';
END $$;