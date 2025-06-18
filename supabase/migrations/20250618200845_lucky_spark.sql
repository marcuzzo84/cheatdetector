/*
  # Drop unused and low-value indexes

  1. Changes
     - Drop unused index `idx_uploaded_files_file_type` on `uploaded_files.file_type`
     - Drop low-cardinality index `idx_uploaded_files_processed` on `uploaded_files.processed`

  2. Rationale
     - The `idx_uploaded_files_file_type` index has never been utilized in any queries
     - The `idx_uploaded_files_processed` index is on a boolean column with very low cardinality
     - For low cardinality columns, PostgreSQL often performs better with bitmap scans rather than index scans
     - Removing unused indexes reduces storage overhead and improves write performance

  3. Performance Benefits
     - Reduced storage overhead for index data
     - Eliminated unnecessary index maintenance during INSERT/UPDATE operations
     - Improved write performance for file uploads
     - Simplified query planning and execution
*/

-- Check if the file_type index exists before dropping it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'uploaded_files' 
    AND indexname = 'idx_uploaded_files_file_type'
  ) THEN
    -- Drop the unused index
    DROP INDEX public.idx_uploaded_files_file_type;
    
    RAISE NOTICE 'Dropped unused index idx_uploaded_files_file_type on uploaded_files.file_type';
  ELSE
    RAISE NOTICE 'Index idx_uploaded_files_file_type does not exist or has already been dropped';
  END IF;
END $$;

-- Check if the processed index exists and drop it as well (low cardinality)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'uploaded_files' 
    AND indexname = 'idx_uploaded_files_processed'
  ) THEN
    -- Drop the low-value index
    DROP INDEX public.idx_uploaded_files_processed;
    
    RAISE NOTICE 'Dropped low-value index idx_uploaded_files_processed on uploaded_files.processed';
  ELSE
    RAISE NOTICE 'Index idx_uploaded_files_processed does not exist or has already been dropped';
  END IF;
END $$;

-- Document the optimization
DO $$
BEGIN
  RAISE NOTICE '=== Unused Indexes Removed from uploaded_files Table ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Performance Benefits:';
  RAISE NOTICE '- Reduced storage overhead for index data';
  RAISE NOTICE '- Eliminated unnecessary index maintenance during INSERT/UPDATE operations';
  RAISE NOTICE '- Improved write performance for file uploads';
  RAISE NOTICE '- Simplified query planning and execution';
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes Removed:';
  RAISE NOTICE '- idx_uploaded_files_file_type (never utilized in queries)';
  RAISE NOTICE '- idx_uploaded_files_processed (low cardinality boolean column)';
  RAISE NOTICE '';
  RAISE NOTICE 'Retained Indexes:';
  RAISE NOTICE '- idx_uploaded_files_created_at (useful for sorting by upload date)';
  RAISE NOTICE '- idx_uploaded_files_user_id (essential for user-based filtering)';
  RAISE NOTICE '- uploaded_files_pkey (primary key)';
  RAISE NOTICE '';
  RAISE NOTICE 'Rationale:';
  RAISE NOTICE '- The file_type column has low cardinality (only a few distinct values)';
  RAISE NOTICE '- Queries rarely filter by file_type alone without other conditions';
  RAISE NOTICE '- The processed column is boolean with very low cardinality';
  RAISE NOTICE '- For low cardinality columns, PostgreSQL often prefers bitmap scans over index scans';
  RAISE NOTICE '- Removing unused indexes is a database optimization best practice';
END $$;