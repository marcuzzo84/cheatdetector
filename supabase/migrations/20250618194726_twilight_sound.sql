/*
  # Drop unused and redundant indexes

  1. Unused Indexes
     - Removes redundant indexes that are covered by other existing indexes
     - Drops unused specialized indexes that don't benefit query patterns
  
  2. Performance Benefits
     - Reduces database storage overhead
     - Eliminates unnecessary index maintenance during write operations
     - Improves INSERT/UPDATE/DELETE performance
     - Simplifies query planning
*/

-- Check and drop redundant index on security_events.user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'security_events' 
    AND indexname = 'idx_security_events_user'
  ) THEN
    -- This index is redundant because we already have idx_security_events_user_created
    -- which includes user_id and created_at and provides the same functionality plus sorting
    DROP INDEX public.idx_security_events_user;
    
    RAISE NOTICE 'Dropped redundant index idx_security_events_user on security_events.user_id';
  ELSE
    RAISE NOTICE 'Index idx_security_events_user does not exist or has already been dropped';
  END IF;
END $$;

-- Check and drop redundant index on scores.suspicion_level
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'scores' 
    AND indexname = 'idx_scores_suspicion_level'
  ) THEN
    -- This index is redundant because we already have idx_scores_high_suspicion_created
    -- which is more specific and useful for the common query pattern
    DROP INDEX public.idx_scores_suspicion_level;
    
    RAISE NOTICE 'Dropped redundant index idx_scores_suspicion_level on scores.suspicion_level';
  ELSE
    RAISE NOTICE 'Index idx_scores_suspicion_level does not exist or has already been dropped';
  END IF;
END $$;

-- Check and drop redundant index on scores.ml_prob
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'scores' 
    AND indexname = 'idx_scores_ml_prob'
  ) THEN
    -- This index is redundant because we already have idx_scores_ml_prob_desc
    -- which includes the same column but with a more useful sort order
    DROP INDEX public.idx_scores_ml_prob;
    
    RAISE NOTICE 'Dropped redundant index idx_scores_ml_prob on scores.ml_prob';
  ELSE
    RAISE NOTICE 'Index idx_scores_ml_prob does not exist or has already been dropped';
  END IF;
END $$;

-- Check and drop unused index on sync_cursor.updated_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'sync_cursor' 
    AND indexname = 'idx_sync_cursor_updated_at'
  ) THEN
    -- This index is rarely used and the table is small enough that a sequential scan is efficient
    DROP INDEX public.idx_sync_cursor_updated_at;
    
    RAISE NOTICE 'Dropped unused index idx_sync_cursor_updated_at on sync_cursor.updated_at';
  ELSE
    RAISE NOTICE 'Index idx_sync_cursor_updated_at does not exist or has already been dropped';
  END IF;
END $$;

-- Document the optimization
DO $$
BEGIN
  RAISE NOTICE '=== Unused and Redundant Indexes Removed ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Performance Benefits:';
  RAISE NOTICE '- Reduced storage overhead for index data';
  RAISE NOTICE '- Eliminated unnecessary index maintenance during INSERT/UPDATE operations';
  RAISE NOTICE '- Improved write performance for affected tables';
  RAISE NOTICE '- Simplified query planning and execution';
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes Removed:';
  RAISE NOTICE '- idx_security_events_user (redundant with idx_security_events_user_created)';
  RAISE NOTICE '- idx_scores_suspicion_level (redundant with idx_scores_high_suspicion_created)';
  RAISE NOTICE '- idx_scores_ml_prob (redundant with idx_scores_ml_prob_desc)';
  RAISE NOTICE '- idx_sync_cursor_updated_at (low value for small table)';
  RAISE NOTICE '';
  RAISE NOTICE 'Rationale:';
  RAISE NOTICE '- Redundant indexes increase storage requirements and slow down write operations';
  RAISE NOTICE '- Specialized indexes that are never used add overhead without benefit';
  RAISE NOTICE '- For small tables, sequential scans can be more efficient than index scans';
  RAISE NOTICE '- Removing unused indexes is a database optimization best practice';
END $$;