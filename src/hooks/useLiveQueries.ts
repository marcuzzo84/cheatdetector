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
      // Query for daily suspicion trends over the last 30 days
      const { data, error } = await supabase
        .from('scores')
        .select(`
          created_at,
          suspicion_level,
          games!inner (
            date
          )
        `)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching suspicion trends:', error);
        setError(error.message);
        return;
      }

      // Group data by date and calculate daily metrics
      const dailyData: { [key: string]: { total: number; suspicious: number } } = {};
      
      data.forEach(score => {
        const date = new Date(score.created_at).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { total: 0, suspicious: 0 };
        }
        dailyData[date].total++;
        if (score.suspicion_level >= 70) {
          dailyData[date].suspicious++;
        }
      });

      // Convert to trend format
      const trendData: SuspicionTrend[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayData = dailyData[dateStr] || { total: 0, suspicious: 0 };
        const suspicionRate = dayData.total > 0 ? (dayData.suspicious / dayData.total) * 100 : 0;
        
        trendData.push({
          date: dateStr,
          suspicion_rate: suspicionRate,
          volume: dayData.total
        });
      }

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

    // Set up realtime subscription for live updates
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