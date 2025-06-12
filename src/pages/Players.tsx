import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LivePlayer {
  id: string;
  hash: string;
  elo: number;
  created_at: string;
  games_count: number;
  avg_suspicion: number;
  avg_engine_match: number;
  avg_ml_prob: number;
  last_seen: string;
}

const Players: React.FC = () => {
  const [players, setPlayers] = useState<LivePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suspicionFilter, setSuspicionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('suspicion');

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      
      // Fetch players with aggregated statistics
      const { data, error } = await supabase
        .from('players')
        .select(`
          *,
          games!inner (
            id,
            scores!inner (
              suspicion_level,
              match_engine_pct,
              ml_prob,
              created_at
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        setError(error.message);
        return;
      }

      // Transform and aggregate the data
      const transformedPlayers: LivePlayer[] = data.map(player => {
        const allScores = player.games.flatMap(game => game.scores);
        const gamesCount = player.games.length;
        const avgSuspicion = allScores.length > 0 
          ? allScores.reduce((sum, score) => sum + score.suspicion_level, 0) / allScores.length 
          : 0;
        const avgEngineMatch = allScores.length > 0 
          ? allScores.reduce((sum, score) => sum + (score.match_engine_pct || 0), 0) / allScores.length 
          : 0;
        const avgMlProb = allScores.length > 0 
          ? allScores.reduce((sum, score) => sum + (score.ml_prob || 0), 0) / allScores.length 
          : 0;
        
        // Find most recent activity
        const mostRecentScore = allScores.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        const lastSeen = mostRecentScore 
          ? formatTimeAgo(mostRecentScore.created_at)
          : formatTimeAgo(player.created_at);

        return {
          id: player.id,
          hash: player.hash,
          elo: player.elo || 0,
          created_at: player.created_at,
          games_count: gamesCount,
          avg_suspicion: Math.round(avgSuspicion),
          avg_engine_match: avgEngineMatch,
          avg_ml_prob: avgMlProb,
          last_seen: lastSeen
        };
      });

      setPlayers(transformedPlayers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    return 'Recently';
  };

  useEffect(() => {
    fetchPlayers();

    // Set up realtime subscription
    const channel = supabase
      .channel('players-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        fetchPlayers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getSuspicionBadge = (level: number) => {
    if (level >= 70) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle className="w-3 h-3 mr-1" />
          High Risk
        </span>
      );
    }
    if (level >= 40) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <Activity className="w-3 h-3 mr-1" />
          Suspicious
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Clean
      </span>
    );
  };

  const getSuspicionIcon = (level: number) => {
    if (level >= 70) return TrendingUp;
    if (level >= 40) return Activity;
    return TrendingDown;
  };

  const filteredAndSortedPlayers = players
    .filter(player => {
      const matchesSearch = player.hash.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSuspicion = suspicionFilter === 'all' || 
        (suspicionFilter === 'high' && player.avg_suspicion >= 70) ||
        (suspicionFilter === 'medium' && player.avg_suspicion >= 40 && player.avg_suspicion < 70) ||
        (suspicionFilter === 'low' && player.avg_suspicion < 40);
      
      return matchesSearch && matchesSuspicion;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'suspicion':
          return b.avg_suspicion - a.avg_suspicion;
        case 'elo':
          return b.elo - a.elo;
        case 'games':
          return b.games_count - a.games_count;
        case 'mlProb':
          return b.avg_ml_prob - a.avg_ml_prob;
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Players</h1>
          <p className="mt-2 text-gray-600">Monitor and analyze player behavior patterns</p>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin mb-2" />
            <p className="text-gray-500">Loading players from database...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Players</h1>
          <p className="mt-2 text-gray-600">Monitor and analyze player behavior patterns</p>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">Error loading players: {error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Players</h1>
        <p className="mt-2 text-gray-600">Monitor and analyze player behavior patterns ({players.length} total players)</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by player hash..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={suspicionFilter}
              onChange={(e) => setSuspicionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Risk Levels</option>
              <option value="high">High Risk (70%+)</option>
              <option value="medium">Suspicious (40-69%)</option>
              <option value="low">Clean (&lt;40%)</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="suspicion">Sort by Suspicion</option>
              <option value="elo">Sort by Elo</option>
              <option value="games">Sort by Games</option>
              <option value="mlProb">Sort by ML Probability</option>
            </select>
          </div>
        </div>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedPlayers.map((player) => {
          const SuspicionIcon = getSuspicionIcon(player.avg_suspicion);
          return (
            <div key={player.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 font-mono truncate">
                    {player.hash.substring(0, 16)}...
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Last seen: {player.last_seen}</p>
                </div>
                <div className="flex items-center space-x-1">
                  <SuspicionIcon className={`w-4 h-4 ${
                    player.avg_suspicion >= 70 ? 'text-red-500' :
                    player.avg_suspicion >= 40 ? 'text-orange-500' : 'text-green-500'
                  }`} />
                  <span className={`text-sm font-bold ${
                    player.avg_suspicion >= 70 ? 'text-red-600' :
                    player.avg_suspicion >= 40 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {player.avg_suspicion}%
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Elo</span>
                    <p className="font-semibold text-gray-900">{player.elo}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Games</span>
                    <p className="font-semibold text-gray-900">{player.games_count}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Engine Match</span>
                    <span className="font-medium">{player.avg_engine_match.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-blue-500 h-1.5 rounded-full" 
                      style={{ width: `${Math.min(player.avg_engine_match, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ML Probability</span>
                    <span className="font-medium">{(player.avg_ml_prob * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-orange-500 h-1.5 rounded-full" 
                      style={{ width: `${player.avg_ml_prob * 100}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  {getSuspicionBadge(player.avg_suspicion)}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link
                  to={`/players/${player.hash}`}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAndSortedPlayers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No players found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters.</p>
        </div>
      )}
    </div>
  );
};

export default Players;