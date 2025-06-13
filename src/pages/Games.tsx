import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, AlertTriangle, CheckCircle, Clock, Filter, Search, Calendar, Loader2, Download, Database } from 'lucide-react';
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

  const fetchGames = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First check if we have any games data
      const { data: gamesCount, error: countError } = await supabase
        .from('games')
        .select('id', { count: 'exact', head: true });

      if (countError) {
        console.error('Error checking games count:', countError);
        setError(countError.message);
        setGames([]);
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
      
      // Fetch games with player and score data
      const { data, error } = await supabase
        .from('games')
        .select(`
          *,
          players!inner (
            hash,
            elo
          ),
          scores!inner (
            suspicion_level,
            match_engine_pct,
            ml_prob,
            created_at
          )
        `)
        .order('date', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching games:', error);
        setError(error.message);
        setGames([]);
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
      const transformedGames: LiveGame[] = data.map(game => {
        const player = game.players;
        const score = game.scores[0]; // Get the first score for this game
        
        return {
          id: game.id,
          player_hash: player.hash,
          site: game.site,
          date: game.date,
          result: game.result || 'Unknown',
          elo: player.elo || 0,
          suspicion_level: score?.suspicion_level || 0,
          match_engine_pct: score?.match_engine_pct || 0,
          ml_prob: score?.ml_prob || 0,
          created_at: game.created_at
        };
      });

      setGames(transformedGames);
      setError(null);
    } catch (err) {
      console.error('Error in fetchGames:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();

    // Set up realtime subscription
    const channel = supabase
      .channel('games-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
        fetchGames();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        fetchGames();
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
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Import Games</span>
          </button>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin mb-2" />
            <p className="text-gray-500">Loading games from database...</p>
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
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Import Games</span>
          </button>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">Error loading games: {error}</span>
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
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Import Games</span>
        </button>
      </div>

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