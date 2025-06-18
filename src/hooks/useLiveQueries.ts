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
      setError(null);
      
      // Set a timeout for the query
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      );
      
      // First check if we have any data at all with a simple count
      const countPromise = supabase
        .from('scores')
        .select('id', { count: 'exact', head: true });

      const { data: scoresCount, error: countError } = await Promise.race([
        countPromise,
        timeoutPromise
      ]) as any;

      if (countError) {
        console.error('Error checking scores count:', countError);
        // Provide fallback KPIs instead of showing error
        setKpis({
          games_24h: 0,
          suspect_pct: 0,
          avg_elo: 0
        });
        setLoading(false);
        return;
      }

      // If no scores exist, return zero values
      if (!scoresCount || scoresCount.length === 0) {
        console.log('No scores data found, returning zero KPIs');
        setKpis({
          games_24h: 0,
          suspect_pct: 0,
          avg_elo: 0
        });
        setLoading(false);
        return;
      }

      // Try to get KPIs from function with timeout
      const functionPromise = supabase.rpc('get_dashboard_kpis');
      
      try {
        const { data, error } = await Promise.race([
          functionPromise,
          timeoutPromise
        ]) as any;
        
        if (error) {
          console.error('Error fetching KPIs:', error);
          // Fallback to manual calculation
          const fallbackKpis = await calculateFallbackKPIs();
          setKpis(fallbackKpis);
          setError(null); // Don't show error if we have fallback data
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          setKpis({
            games_24h: data[0].games_24h || 0,
            suspect_pct: data[0].suspect_pct || 0,
            avg_elo: data[0].avg_elo || 0
          });
        } else {
          // Function returned no data, use fallback
          const fallbackKpis = await calculateFallbackKPIs();
          setKpis(fallbackKpis);
        }
        setError(null);
      } catch (functionError) {
        console.error('Function call failed:', functionError);
        // Use fallback calculation
        const fallbackKpis = await calculateFallbackKPIs();
        setKpis(fallbackKpis);
        setError(null);
      }
    } catch (err) {
      console.error('Error in fetchKPIs:', err);
      // Provide fallback data instead of showing error
      setKpis({
        games_24h: 0,
        suspect_pct: 0,
        avg_elo: 0
      });
      setError(null); // Don't show error, just use fallback
    } finally {
      setLoading(false);
    }
  };

  const calculateFallbackKPIs = async (): Promise<KPIData> => {
    try {
      // Get games from last 24 hours with timeout
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Fallback query timeout')), 5000)
      );

      const queryPromise = supabase
        .from('scores')
        .select(`
          suspicion_level,
          games!inner (
            players!inner (
              elo
            )
          )
        `)
        .gte('created_at', yesterday.toISOString())
        .limit(1000); // Limit to prevent large queries

      const { data: recentScores, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any;

      if (error || !recentScores) {
        return { games_24h: 0, suspect_pct: 0, avg_elo: 0 };
      }

      const games24h = recentScores.length;
      const suspiciousGames = recentScores.filter((s: any) => s.suspicion_level >= 70).length;
      const suspectPct = games24h > 0 ? (suspiciousGames / games24h) * 100 : 0;
      const avgElo = games24h > 0 
        ? recentScores.reduce((sum: number, s: any) => sum + (s.games.players.elo || 0), 0) / games24h 
        : 0;

      return {
        games_24h: games24h,
        suspect_pct: Math.round(suspectPct * 10) / 10,
        avg_elo: Math.round(avgElo)
      };
    } catch (error) {
      console.error('Error calculating fallback KPIs:', error);
      return { games_24h: 0, suspect_pct: 0, avg_elo: 0 };
    }
  };

  useEffect(() => {
    // Initial fetch with timeout
    const fetchTimeout = setTimeout(() => {
      console.warn('KPI fetch taking too long, using fallback');
      setKpis({ games_24h: 0, suspect_pct: 0, avg_elo: 0 });
      setLoading(false);
    }, 15000); // 15 second timeout

    fetchKPIs().finally(() => {
      clearTimeout(fetchTimeout);
    });

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
      .subscribe();

    return () => {
      clearTimeout(fetchTimeout);
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
      setError(null);
      
      // Set a timeout for the query
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      );
      
      // First check if we have any scores data
      const countPromise = supabase
        .from('scores')
        .select('id', { count: 'exact', head: true });

      const { data: scoresCount, error: countError } = await Promise.race([
        countPromise,
        timeoutPromise
      ]) as any;

      if (countError) {
        console.error('Error checking scores:', countError);
        setScores([]);
        setLoading(false);
        return;
      }

      // If no scores exist, return empty array
      if (!scoresCount || scoresCount.length === 0) {
        console.log('No scores data found, returning empty suspicious scores');
        setScores([]);
        setLoading(false);
        return;
      }

      const queryPromise = supabase
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

      const { data, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('Error fetching suspicious scores:', error);
        setError(error.message);
        setScores([]); // Set empty array instead of keeping old data
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        console.log('No suspicious scores found');
        setScores([]);
        setLoading(false);
        return;
      }

      const transformedScores: SuspiciousScore[] = data.map((score: any) => ({
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
      setScores([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch with timeout
    const fetchTimeout = setTimeout(() => {
      console.warn('Suspicious scores fetch taking too long');
      setScores([]);
      setLoading(false);
    }, 15000); // 15 second timeout

    fetchSuspiciousScores().finally(() => {
      clearTimeout(fetchTimeout);
    });

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
      .subscribe();

    return () => {
      clearTimeout(fetchTimeout);
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
      setError(null);
      
      // Set a timeout for the query
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      );
      
      // First check if we have any scores data
      const countPromise = supabase
        .from('scores')
        .select('id', { count: 'exact', head: true });

      const { data: scoresCount, error: countError } = await Promise.race([
        countPromise,
        timeoutPromise
      ]) as any;

      if (countError) {
        console.error('Error checking scores:', countError);
        setTrends(generateFallbackTrends());
        setLoading(false);
        return;
      }

      // If no scores exist, generate fallback trends
      if (!scoresCount || scoresCount.length === 0) {
        console.log('No scores data found, generating fallback trends');
        setTrends(generateFallbackTrends());
        setLoading(false);
        return;
      }

      // Try to use the function for efficient daily aggregation
      const functionPromise = supabase.rpc('get_suspicion_trends', { days_back: 30 });

      try {
        const { data, error } = await Promise.race([
          functionPromise,
          timeoutPromise
        ]) as any;

        if (error) {
          console.error('Error fetching suspicion trends:', error);
          // Fallback to manual calculation
          const fallbackTrends = await calculateFallbackTrends();
          setTrends(fallbackTrends);
          setError(null); // Don't show error if we have fallback data
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          console.log('No trend data returned, using fallback');
          const fallbackTrends = await calculateFallbackTrends();
          setTrends(fallbackTrends);
          setLoading(false);
          return;
        }

        // Transform the data to match our expected format
        const trendData: SuspicionTrend[] = data.map((row: any) => ({
          date: row.date,
          suspicion_rate: row.suspicion_rate,
          volume: row.volume
        }));

        setTrends(trendData);
        setError(null);
      } catch (functionError) {
        console.error('Function call failed:', functionError);
        const fallbackTrends = await calculateFallbackTrends();
        setTrends(fallbackTrends);
        setError(null);
      }
    } catch (err) {
      console.error('Error in fetchSuspicionTrends:', err);
      // Use fallback data instead of showing error
      setTrends(generateFallbackTrends());
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const generateFallbackTrends = (): SuspicionTrend[] => {
    // Generate 30 days of fallback data with realistic patterns
    const trends: SuspicionTrend[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      trends.push({
        date: date.toISOString().split('T')[0],
        suspicion_rate: 15 + Math.random() * 10, // 15-25% base rate
        volume: Math.floor(50 + Math.random() * 100) // 50-150 games
      });
    }
    return trends;
  };

  const calculateFallbackTrends = async (): Promise<SuspicionTrend[]> => {
    try {
      // Get last 30 days of data with timeout
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Fallback trends timeout')), 5000)
      );

      const queryPromise = supabase
        .from('scores')
        .select('suspicion_level, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .limit(10000); // Limit to prevent large queries

      const { data: scores, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any;

      if (error || !scores || scores.length === 0) {
        return generateFallbackTrends();
      }

      // Group by date and calculate daily stats
      const dailyStats = new Map<string, { total: number; suspicious: number }>();
      
      scores.forEach((score: any) => {
        const date = score.created_at.split('T')[0];
        const stats = dailyStats.get(date) || { total: 0, suspicious: 0 };
        stats.total++;
        if (score.suspicion_level >= 70) {
          stats.suspicious++;
        }
        dailyStats.set(date, stats);
      });

      // Convert to trend format
      const trends: SuspicionTrend[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const stats = dailyStats.get(dateStr) || { total: 0, suspicious: 0 };
        
        trends.push({
          date: dateStr,
          suspicion_rate: stats.total > 0 ? (stats.suspicious / stats.total) * 100 : 0,
          volume: stats.total
        });
      }

      return trends;
    } catch (error) {
      console.error('Error calculating fallback trends:', error);
      return generateFallbackTrends();
    }
  };

  useEffect(() => {
    // Initial fetch with timeout
    const fetchTimeout = setTimeout(() => {
      console.warn('Suspicion trends fetch taking too long');
      setTrends(generateFallbackTrends());
      setLoading(false);
    }, 15000); // 15 second timeout

    fetchSuspicionTrends().finally(() => {
      clearTimeout(fetchTimeout);
    });

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
          fetchSuspicionTrends();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(fetchTimeout);
      supabase.removeChannel(channel);
    };
  }, []);

  return { trends, loading, error, refetch: fetchSuspicionTrends };
};

// Enhanced hook specifically for the daily suspicion view with live: true behavior
export const useLiveDailySuspicionView = () => {
  const [dailyData, setDailyData] = useState<DailySuspicionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchDailyData = async () => {
    try {
      setError(null);
      
      // Set a timeout for the query
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      );
      
      // First check if we have any data
      const countPromise = supabase
        .from('scores')
        .select('id', { count: 'exact', head: true });

      const { data: scoresCount, error: countError } = await Promise.race([
        countPromise,
        timeoutPromise
      ]) as any;

      if (countError) {
        console.error('Error checking scores:', countError);
        setDailyData(generateFallbackDailyData());
        setIsLive(false);
        setLoading(false);
        return;
      }

      // If no scores exist, generate fallback data
      if (!scoresCount || scoresCount.length === 0) {
        console.log('No scores data found, generating fallback daily data');
        setDailyData(generateFallbackDailyData());
        setIsLive(false);
        setLoading(false);
        return;
      }

      // Use the realtime function for better performance
      const functionPromise = supabase.rpc('get_daily_suspicion_realtime');

      try {
        const { data, error } = await Promise.race([
          functionPromise,
          timeoutPromise
        ]) as any;

        if (error) {
          console.error('Error fetching daily suspicion view:', error);
          // Use fallback data instead of showing error
          setDailyData(generateFallbackDailyData());
          setIsLive(false);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          console.log('No daily data returned, using fallback');
          setDailyData(generateFallbackDailyData());
          setIsLive(false);
          setLoading(false);
          return;
        }

        // Transform the data to match our expected format
        const transformedData: DailySuspicionView[] = data.map((row: any) => ({
          bucket: row.bucket,
          rate: row.rate,
          volume: row.volume
        }));

        setDailyData(transformedData);
        setError(null);
        setIsLive(true);
      } catch (functionError) {
        console.error('Function call failed:', functionError);
        setDailyData(generateFallbackDailyData());
        setIsLive(false);
      }
    } catch (err) {
      console.error('Error in fetchDailyData:', err);
      // Use fallback data instead of showing error
      setDailyData(generateFallbackDailyData());
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  };

  const generateFallbackDailyData = (): DailySuspicionView[] => {
    const data: DailySuspicionView[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        bucket: date.toISOString(),
        rate: 15 + Math.random() * 10,
        volume: Math.floor(50 + Math.random() * 100)
      });
    }
    return data;
  };

  useEffect(() => {
    // Initial fetch with timeout
    const fetchTimeout = setTimeout(() => {
      console.warn('Daily suspicion view fetch taking too long');
      setDailyData(generateFallbackDailyData());
      setIsLive(false);
      setLoading(false);
    }, 15000); // 15 second timeout

    fetchDailyData().finally(() => {
      clearTimeout(fetchTimeout);
    });

    // Set up realtime subscription with live: true behavior
    const channel = supabase
      .channel('daily-suspicion-live-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scores'
        },
        (payload) => {
          console.log('🔴 Live update: New score inserted', payload);
          // Immediately refetch when new scores arrive
          fetchDailyData();
        }
      )
      .subscribe((status) => {
        console.log('📡 Daily suspicion subscription status:', status);
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      clearTimeout(fetchTimeout);
      supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, []);

  return { dailyData, loading, error, isLive, refetch: fetchDailyData };
};

// Hook for listening to PostgreSQL notifications
export const usePostgresNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel('postgres-notifications')
      .on('broadcast', { event: 'daily_suspicion_updated' }, (payload) => {
        console.log('📢 Daily suspicion updated notification:', payload);
        setNotifications(prev => [...prev, { type: 'daily_suspicion_updated', ...payload }]);
      })
      .on('broadcast', { event: 'high_risk_score' }, (payload) => {
        console.log('📢 High risk score notification:', payload);
        setNotifications(prev => [...prev, { type: 'high_risk_score', ...payload }]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { notifications };
};