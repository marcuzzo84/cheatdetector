import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface KPIData {
  games_24h: number;
  suspect_pct: number;
  avg_elo: number;
}

export interface SuspiciousScore {
  id: string;
  game_id: string;
  match_engine_pct: number;
  delta_cp: number;
  run_perfect: number;
  ml_prob: number;
  suspicion_level: number;
  created_at: string;
  site: string;
  elo: number;
  player_hash: string;
  player_id: string;
}

export interface SuspicionTrend {
  date: string;
  suspicion_rate: number;
  volume: number;
}

export interface DailySuspicionView {
  bucket: string;
  rate: number;
  volume: number;
}

export const useLiveKPIs = () => {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKPIs = async () => {
    try {
      const { data, error } = await supabase.rpc('get_dashboard_kpis');
      
      if (error) {
        console.error('Error fetching KPIs:', error);
        setError(error.message);
        return;
      }

      if (data && data.length > 0) {
        setKpis({
          games_24h: data[0].games_24h || 0,
          suspect_pct: data[0].suspect_pct || 0,
          avg_elo: data[0].avg_elo || 0
        });
      }
      setError(null);
    } catch (err) {
      console.error('Error in fetchKPIs:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchKPIs();

    // Set up realtime subscription for live updates
    const channel = supabase
      .channel('kpis-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores'
        },
        () => {
          // Refetch KPIs when scores table changes
          fetchKPIs();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games'
        },
        () => {
          // Refetch KPIs when games table changes
          fetchKPIs();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players'
        },
        () => {
          // Refetch KPIs when players table changes
          fetchKPIs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { kpis, loading, error, refetch: fetchKPIs };
};

export const useLiveSuspiciousScores = () => {
  const [scores, setScores] = useState<SuspiciousScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuspiciousScores = async () => {
    try {
      const { data, error } = await supabase
        .from('scores')
        .select(`
          *,
          games!inner (
            site,
            players!inner (
              hash,
              elo
            )
          )
        `)
        .gte('suspicion_level', 80)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching suspicious scores:', error);
        setError(error.message);
        return;
      }

      const transformedScores: SuspiciousScore[] = data.map(score => ({
        id: score.id,
        game_id: score.game_id,
        match_engine_pct: score.match_engine_pct,
        delta_cp: score.delta_cp,
        run_perfect: score.run_perfect,
        ml_prob: score.ml_prob,
        suspicion_level: score.suspicion_level,
        created_at: score.created_at,
        site: score.games.site,
        elo: score.games.players.elo,
        player_hash: score.games.players.hash,
        player_id: score.games.players.id
      }));

      setScores(transformedScores);
      setError(null);
    } catch (err) {
      console.error('Error in fetchSuspiciousScores:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchSuspiciousScores();

    // Set up realtime subscription for live updates
    const channel = supabase
      .channel('suspicious-scores-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scores',
          filter: 'suspicion_level.gte.80'
        },
        () => {
          // Refetch when new suspicious scores are added
          fetchSuspiciousScores();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scores'
        },
        () => {
          // Refetch when scores are updated
          fetchSuspiciousScores();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { scores, loading, error, refetch: fetchSuspiciousScores };
};

export const useLiveSuspicionTrends = () => {
  const [trends, setTrends] = useState<SuspicionTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuspicionTrends = async () => {
    try {
      // Use the new function for efficient daily aggregation
      const { data, error } = await supabase.rpc('get_suspicion_trends', { days_back: 30 });

      if (error) {
        console.error('Error fetching suspicion trends:', error);
        setError(error.message);
        return;
      }

      // Transform the data to match our expected format
      const trendData: SuspicionTrend[] = data.map(row => ({
        date: row.date,
        suspicion_rate: row.suspicion_rate,
        volume: row.volume
      }));

      setTrends(trendData);
      setError(null);
    } catch (err) {
      console.error('Error in fetchSuspicionTrends:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchSuspicionTrends();

    // Set up realtime subscription for live updates using the aggregated view
    const channel = supabase
      .channel('suspicion-trends-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scores'
        },
        () => {
          // Refetch trends when new scores are added
          // The view will automatically recalculate daily aggregations
          fetchSuspicionTrends();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scores'
        },
        () => {
          // Refetch trends when scores are updated
          fetchSuspicionTrends();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { trends, loading, error, refetch: fetchSuspicionTrends };
};

// New hook specifically for the daily suspicion view
export const useLiveDailySuspicionView = () => {
  const [dailyData, setDailyData] = useState<DailySuspicionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDailyData = async () => {
    try {
      const { data, error } = await supabase
        .from('v_daily_suspicion')
        .select('*')
        .order('bucket', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Error fetching daily suspicion view:', error);
        setError(error.message);
        return;
      }

      setDailyData(data || []);
      setError(null);
    } catch (err) {
      console.error('Error in fetchDailyData:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchDailyData();

    // Set up realtime subscription to the view itself
    const channel = supabase
      .channel('daily-suspicion-view-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'v_daily_suspicion'
        },
        (payload) => {
          console.log('Daily suspicion view updated:', payload);
          // Refetch when the view changes
          fetchDailyData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scores'
        },
        () => {
          // Also listen to scores table changes as backup
          fetchDailyData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { dailyData, loading, error, refetch: fetchDailyData };
};