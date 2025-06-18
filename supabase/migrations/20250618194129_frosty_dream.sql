/*
  # Drop unused index on players table

  1. Changes
    - Drops the unused index `idx_players_hash` on the `players` table
    - Keeps the unique index `players_hash_key` which is still needed for the unique constraint

  2. Performance Benefits
    - Reduces database storage overhead
    - Eliminates index maintenance costs during writes
    - Simplifies query planning
*/

-- Check if the index exists before dropping it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'players' 
    AND indexname = 'idx_players_hash'
  ) THEN
    -- Drop the unused index
    DROP INDEX public.idx_players_hash;
    
    RAISE NOTICE 'Dropped unused index idx_players_hash on players.hash';
  ELSE
    RAISE NOTICE 'Index idx_players_hash does not exist or has already been dropped';
  END IF;
END $$;

-- Document the optimization
DO $$
BEGIN
  RAISE NOTICE '=== Unused Index Removed from players.hash ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Performance Benefits:';
  RAISE NOTICE '- Reduced storage overhead for index data';
  RAISE NOTICE '- Eliminated unnecessary index maintenance during INSERT/UPDATE operations';
  RAISE NOTICE '- Simplified query planning and execution';
  RAISE NOTICE '- Maintained data integrity with the unique constraint index (players_hash_key)';
  RAISE NOTICE '';
  RAISE NOTICE 'Index Details:';
  RAISE NOTICE '- Removed: idx_players_hash (non-unique B-tree index)';
  RAISE NOTICE '- Retained: players_hash_key (unique constraint index)';
  RAISE NOTICE '';
  RAISE NOTICE 'Rationale:';
  RAISE NOTICE '- The index was never utilized in any queries';
  RAISE NOTICE '- The unique constraint index (players_hash_key) already provides indexing on the hash column';
  RAISE NOTICE '- Duplicate indexes increase storage requirements and slow down write operations';
  RAISE NOTICE '- Removing unused indexes is a database optimization best practice';
END $$;