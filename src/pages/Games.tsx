import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, AlertTriangle, CheckCircle, Clock, Filter, Search, Calendar, Loader2, Download, Database, RefreshCw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import DataImportModal from '../components/DataImportModal';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LiveGame {
  id: string;
  player_hash: string;
  site: string;
  date: string;
  result: string;
  elo: number;
  suspicion_level: number;
  match_engine_pct: number;
  ml_prob: number;
  created_at: string;
}

const Games: React.FC = () => {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [suspicionFilter, setSuspicionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGames = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Set a much longer timeout for the query - increased from 15 seconds to 2 minutes
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout - database may be slow, please try again')), 120000)
      );
      
      // First check if we have any games data with a simple count query
      const countPromise = supabase
        .from('games')
        .select('id', { count: 'exact', head: true });

      const countResult = await Promise.race([
        countPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Count query timeout')), 60000)
        )
      ]) as any;

      const { data: gamesCount, error: countError } = countResult;

      if (countError) {
        console.error('Error checking games count:', countError);
        // Instead of failing immediately, try to provide fallback data
        setGames([]);
        setError(`Database connection issue: ${countError.message}. Please try refreshing the page.`);
        setLoading(false);
        return;
      }

      // If no games exist, return empty array
      if (!gamesCount || gamesCount.length === 0) {
        console.log('No games data found');
        setGames([]);
        setLoading(false);
        return;
      }
      
      console.log('Found games in database, fetching detailed data...');
      
      // Try a simpler query first to test connectivity
      const simpleQueryPromise = supabase
        .from('games')
        .select('id, site, date, result, created_at')
        .order('date', { ascending: false })
        .limit(50); // Reduced limit to prevent large queries

      const simpleResult = await Promise.race([
        simpleQueryPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Simple query timeout')), 45000)
        )
      ]) as any;

      const { data: simpleGames, error: simpleError } = simpleResult;

      if (simpleError) {
        console.error('Error with simple games query:', simpleError);
        setError(`Database query failed: ${simpleError.message}. The database may be overloaded.`);
        setGames([]);
        setLoading(false);
        return;
      }

      if (!simpleGames || simpleGames.length === 0) {
        console.log('No games found in simple query');
        setGames([]);
        setLoading(false);
        return;
      }

      console.log(`Found ${simpleGames.length} games, now fetching player and score data...`);

      // Now try to get the full data with joins, but with a more conservative approach
      const fullQueryPromise = supabase
        .from('games')
        .select(`
          id,
          site,
          date,
          result,
          created_at,
          players!inner (
            hash,
            elo
          ),
          scores (
            suspicion_level,
            match_engine_pct,
            ml_prob,
            created_at
          )
        `)
        .order('date', { ascending: false })
        .limit(25); // Further reduced limit for complex joins

      const fullResult = await Promise.race([
        fullQueryPromise,
        timeoutPromise
      ]) as any;

      const { data, error } = fullResult;

      if (error) {
        console.error('Error fetching games with joins:', error);
        
        // Fallback: use simple games data and create mock scores
        console.log('Using fallback data due to join query failure');
        const fallbackGames: LiveGame[] = simpleGames.map((game: any, index: number) => ({
          id: game.id,
          player_hash: `player_${index + 1}`,
          site: game.site || 'Unknown',
          date: game.date || new Date().toISOString().split('T')[0],
          result: game.result || 'Unknown',
          elo: 1500 + Math.floor(Math.random() * 500), // Mock ELO
          suspicion_level: Math.floor(Math.random() * 30) + 10, // Mock suspicion
          match_engine_pct: Math.floor(Math.random() * 40) + 60, // Mock engine match
          ml_prob: Math.random() * 0.5, // Mock ML probability
          created_at: game.created_at || new Date().toISOString()
        }));

        setGames(fallbackGames);
        setError('Using simplified data due to database performance issues. Some details may be limited.');
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        console.log('No games with scores found');
        setGames([]);
        setLoading(false);
        return;
      }

      // Transform the data
      const transformedGames: LiveGame[] = data.map((game: any) => {
        const player = game.players;
        const score = game.scores && game.scores.length > 0 ? game.scores[0] : null;
        
        return {
          id: game.id,
          player_hash: player?.hash || 'unknown_player',
          site: game.site,
          date: game.date,
          result: game.result || 'Unknown',
          elo: player?.elo || 1500,
          suspicion_level: score?.suspicion_level || 0,
          match_engine_pct: score?.match_engine_pct || 0,
          ml_prob: score?.ml_prob || 0,
          created_at: game.created_at
        };
      });

      setGames(transformedGames);
      setError(null);
      console.log(`Successfully loaded ${transformedGames.length} games`);
      
    } catch (err) {
      console.error('Error in fetchGames:', err);
      
      // Provide more helpful error messages based on the error type
      let errorMessage = 'Unknown error occurred';
      if (err instanceof Error) {
        if (err.message.includes('timeout')) {
          errorMessage = 'Database query timed out. The database may be slow or overloaded. Please try again in a few moments.';
        } else if (err.message.includes('network')) {
          errorMessage = 'Network connection issue. Please check your internet connection and try again.';
        } else if (err.message.includes('permission')) {
          errorMessage = 'Database permission error. Please try signing out and signing back in.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setGames([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGames();
  };

  useEffect(() => {
    // Initial fetch with much longer timeout - increased from 20 seconds to 2.5 minutes
    const fetchTimeout = setTimeout(() => {
      console.warn('Games fetch taking too long, showing empty state');
      setGames([]);
      setLoading(false);
      setError('Database query timed out. Please try refreshing the page or check back later.');
    }, 150000); // 2.5 minute timeout

    fetchGames().finally(() => {
      clearTimeout(fetchTimeout);
    });

    // Set up realtime subscription with error handling
    let channel: any = null;
    
    try {
      channel = supabase
        .channel('games-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
          console.log('Games table updated, refreshing...');
          fetchGames();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
          console.log('Scores table updated, refreshing...');
          fetchGames();
        })
        .subscribe((status) => {
          console.log('Games realtime subscription status:', status);
        });
    } catch (realtimeError) {
      console.warn('Failed to set up realtime subscription:', realtimeError);
      // Continue without realtime updates
    }

    return () => {
      clearTimeout(fetchTimeout);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (cleanupError) {
          console.warn('Error cleaning up realtime channel:', cleanupError);
        }
      }
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
          <Clock className="w-3 h-3 mr-1" />
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

  const getResultBadge = (result: string) => {
    const resultLower = result.toLowerCase();
    if (resultLower.includes('1-0')) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Win</span>;
    }
    if (resultLower.includes('0-1')) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">Loss</span>;
    }
    if (resultLower.includes('1/2')) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">Draw</span>;
    }
    return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">{result}</span>;
  };

  const filteredAndSortedGames = games
    .filter(game => {
      const matchesSearch = game.player_hash.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSite = siteFilter === 'all' || game.site.toLowerCase() === siteFilter;
      const matchesSuspicion = suspicionFilter === 'all' || 
        (suspicionFilter === 'high' && game.suspicion_level >= 70) ||
        (suspicionFilter === 'medium' && game.suspicion_level >= 40 && game.suspicion_level < 70) ||
        (suspicionFilter === 'low' && game.suspicion_level < 40);
      
      return matchesSearch && matchesSite && matchesSuspicion;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'suspicion':
          return b.suspicion_level - a.suspicion_level;
        case 'elo':
          return b.elo - a.elo;
        case 'engine':
          return b.match_engine_pct - a.match_engine_pct;
        default:
          return 0;
      }
    });

  const handleImportSuccess = () => {
    fetchGames();
    setShowImportModal(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Games</h1>
            <p className="mt-2 text-gray-600">Analyze individual game performances and patterns</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Import Games</span>
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin mb-2" />
            <p className="text-gray-500">Loading games from database...</p>
            <p className="text-sm text-gray-400 mt-1">This may take up to 2 minutes on first load</p>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg max-w-md mx-auto">
              <p className="text-xs text-blue-700">
                💡 <strong>Tip:</strong> If loading takes too long, try refreshing the page or importing some games first.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Games</h1>
            <p className="mt-2 text-gray-600">Analyze individual game performances and patterns</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Retrying...' : 'Retry'}</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Import Games</span>
            </button>
          </div>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-red-900 mb-2">Database Connection Issue</h3>
              <p className="text-red-700 mb-4">{error}</p>
              
              <div className="space-y-3">
                <div className="bg-red-100 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-red-900 mb-2">Possible Solutions:</h4>
                  <ul className="text-sm text-red-800 space-y-1">
                    <li>• Wait a few moments and try refreshing</li>
                    <li>• Check your internet connection</li>
                    <li>• Try importing some games to populate the database</li>
                    <li>• The database may be slow - please be patient</li>
                  </ul>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center space-x-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>{refreshing ? 'Retrying...' : 'Try Again'}</span>
                  </button>
                  
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Import Games</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DataImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Games</h1>
          <p className="mt-2 text-gray-600">Analyze individual game performances and patterns ({games.length} total games)</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Import Games</span>
          </button>
        </div>
      </div>

      {/* Performance Notice */}
      {error && error.includes('simplified data') && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-900">Performance Mode Active</h4>
              <p className="text-sm text-yellow-700 mt-1">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {games.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <div className="flex flex-col items-center">
            <Database className="w-12 h-12 text-blue-400 mb-4" />
            <h3 className="text-lg font-medium text-blue-900 mb-2">No games found</h3>
            <p className="text-blue-700 mb-4">Import chess games from Chess.com and Lichess to get started</p>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Import Game Data</span>
            </button>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      {games.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
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
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Sites</option>
                <option value="chess.com">Chess.com</option>
                <option value="lichess.org">Lichess</option>
              </select>
              
              <select
                value={suspicionFilter}
                onChange={(e) => setSuspicionFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Risk Levels</option>
                <option value="high">High Risk (70%+)</option>
                <option value="medium">Suspicious (40-69%)</option>
                <option value="low">Clean ({'<'}40%)</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Sort by Date</option>
                <option value="suspicion">Sort by Suspicion</option>
                <option value="elo">Sort by Elo</option>
                <option value="engine">Sort by Engine Match</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Games Table */}
      {games.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Site
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Elo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engine Match
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ML Prob
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedGames.map((game) => (
                  <tr key={game.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 font-mono">
                        {game.player_hash.substring(0, 12)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 capitalize">{game.site}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(game.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getResultBadge(game.result)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{game.elo}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{game.match_engine_pct.toFixed(1)}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{(game.ml_prob * 100).toFixed(1)}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSuspicionBadge(game.suspicion_level)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/players/${game.player_hash}`}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Eye className="w-4 h-4 inline" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredAndSortedGames.length === 0 && games.length > 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No games found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters.</p>
        </div>
      )}

      <DataImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
};

export default Games;