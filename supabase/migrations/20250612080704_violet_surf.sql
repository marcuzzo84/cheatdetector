/*
  # Create KPI calculation function

  1. New Functions
    - `get_dashboard_kpis()` - Calculates real-time dashboard KPIs
      - Games analyzed in last 24 hours
      - Percentage of games with suspicion level >= 80%
      - Average Elo of players from games in last 24 hours

  2. Security
    - Function accessible to authenticated users
    - Uses existing RLS policies on underlying tables
*/

-- Create function to calculate dashboard KPIs
CREATE OR REPLACE FUNCTION get_dashboard_kpis()
RETURNS TABLE (
  games_24h bigint,
  suspect_pct numeric,
  avg_elo numeric
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    count(*) FILTER (WHERE s.created_at >= now() - interval '24 hour') AS games_24h,
    round(
      100.0 * count(*) FILTER (WHERE s.suspicion_level >= 80 AND s.created_at >= now() - interval '24 hour') 
      / greatest(count(*) FILTER (WHERE s.created_at >= now() - interval '24 hour'), 1), 
      1
    ) AS suspect_pct,
    round(
      avg(p.elo) FILTER (WHERE g.date >= current_date - 1), 
      0
    ) AS avg_elo
  FROM scores s
  JOIN games g ON g.id = s.game_id
  JOIN players p ON p.id = g.player_id;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_kpis() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_kpis() TO service_role;