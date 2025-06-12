-- /sql/enable_realtime.sql  (run once from Bolt.new > DB > SQL Editor)
begin;
alter publication supabase_realtime add table public.scores;
commit;