import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface RealtimeScoreEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: 'scores';
  new: {
    id: string;
    game_id: string;
    match_engine_pct: number;
    delta_cp: number;
    run_perfect: number;
    ml_prob: number;
    suspicion_level: number;
    created_at: string;
    player?: {
      id: string;
      hash: string;
      elo: number;
    };
    game?: {
      id: string;
      site: string;
      result: string;
      date: string;
    };
  };
  old?: any;
}

export interface ScoreWithPlayer {
  id: string;
  game_id: string;
  match_engine_pct: number;
  delta_cp: number;
  run_perfect: number;
  ml_prob: number;
  suspicion_level: number;
  created_at: string;
  player: {
    id: string;
    hash: string;
    elo: number;
  };
  game: {
    id: string;
    site: string;
    result: string;
    date: string;
  };
}

export const useRealtimeScores = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [latestScore, setLatestScore] = useState<ScoreWithPlayer | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let channel: any = null;

    const setupRealtimeConnection = async () => {
      try {
        // Check authentication status
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError) {
          setConnectionError(`Authentication error: ${authError.message}`);
          return;
        }

        if (!session) {
          setConnectionError('User not authenticated. Please log in to receive real-time updates.');
          setIsAuthenticated(false);
          return;
        }

        setIsAuthenticated(true);
        setConnectionError(null);

        // Create realtime channel for scores table
        channel = supabase
          .channel('scores-channel')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'scores'
            },
            async (payload) => {
              console.log('Realtime score event received:', payload);
              
              try {
                // Fetch the complete score data with player and game information
                const { data: scoreWithJoins, error: fetchError } = await supabase
                  .from('scores')
                  .select(`
                    *,
                    games!inner (
                      id,
                      site,
                      result,
                      date,
                      players!inner (
                        id,
                        hash,
                        elo
                      )
                    )
                  `)
                  .eq('id', payload.new.id)
                  .single();

                if (fetchError) {
                  console.error('Error fetching score with joins:', fetchError);
                  return;
                }

                // Transform the data to match our expected format
                const transformedScore: ScoreWithPlayer = {
                  id: scoreWithJoins.id,
                  game_id: scoreWithJoins.game_id,
                  match_engine_pct: scoreWithJoins.match_engine_pct,
                  delta_cp: scoreWithJoins.delta_cp,
                  run_perfect: scoreWithJoins.run_perfect,
                  ml_prob: scoreWithJoins.ml_prob,
                  suspicion_level: scoreWithJoins.suspicion_level,
                  created_at: scoreWithJoins.created_at,
                  player: {
                    id: scoreWithJoins.games.players.id,
                    hash: scoreWithJoins.games.players.hash,
                    elo: scoreWithJoins.games.players.elo
                  },
                  game: {
                    id: scoreWithJoins.games.id,
                    site: scoreWithJoins.games.site,
                    result: scoreWithJoins.games.result,
                    date: scoreWithJoins.games.date
                  }
                };

                setLatestScore(transformedScore);
              } catch (error) {
                console.error('Error processing realtime score:', error);
              }
            }
          )
          .subscribe((status) => {
            console.log('Realtime subscription status:', status);
            setIsConnected(status === 'SUBSCRIBED');
            
            if (status === 'CHANNEL_ERROR') {
              setConnectionError('Failed to connect to realtime channel');
            } else if (status === 'TIMED_OUT') {
              setConnectionError('Connection timed out');
            } else if (status === 'CLOSED') {
              setConnectionError('Connection closed');
              setIsConnected(false);
            }
          });

      } catch (error) {
        console.error('Error setting up realtime connection:', error);
        setConnectionError(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    setupRealtimeConnection();

    // Cleanup function
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Method to manually authenticate (for demo purposes)
  const authenticate = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setConnectionError(`Authentication failed: ${error.message}`);
        return false;
      }

      setIsAuthenticated(true);
      setConnectionError(null);
      return true;
    } catch (error) {
      setConnectionError(`Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  // Method to sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setIsConnected(false);
    setLatestScore(null);
  };

  return {
    isConnected,
    isAuthenticated,
    latestScore,
    connectionError,
    authenticate,
    signOut
  };
};