import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Users, AlertCircle, CheckCircle, Loader2, Database, Globe, Zap, Cloud, Activity, Wifi, WifiOff, Play, Pause, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ImportProgress {
  status: 'idle' | 'fetching' | 'processing' | 'completed' | 'error';
  message: string;
  gamesImported: number;
  totalGames: number;
  currentPlayer?: string;
  errors: string[];
}

interface LiveScore {
  id: string;
  game_id: string;
  suspicion_level: number;
  created_at: string;
  player_hash: string;
  site: string;
}

const Import: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    site: 'chess.com' as 'chess.com' | 'lichess',
    username: '',
    limit: 50
  });
  
  const [progress, setProgress] = useState<ImportProgress>({
    status: 'idle',
    message: '',
    gamesImported: 0,
    totalGames: 0,
    errors: []
  });

  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const channelRef = useRef<any>(null);

  // Set up real-time connection for live score updates
  useEffect(() => {
    if (progress.status === 'processing') {
      // Create realtime channel for scores
      channelRef.current = supabase
        .channel('import-scores-stream')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'scores'
          },
          (payload) => {
            console.log('New score received:', payload);
            
            // Add to live scores list
            const newScore: LiveScore = {
              id: payload.new.id,
              game_id: payload.new.game_id,
              suspicion_level: payload.new.suspicion_level,
              created_at: payload.new.created_at,
              player_hash: 'unknown', // We'll need to join this data
              site: 'unknown'
            };
            
            setLiveScores(prev => [newScore, ...prev.slice(0, 9)]); // Keep last 10
            
            // Update progress
            setProgress(prev => ({
              ...prev,
              gamesImported: prev.gamesImported + 1,
              message: `Processing game ${prev.gamesImported + 1}... (Suspicion: ${payload.new.suspicion_level}%)`
            }));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'sync_cursor'
          },
          (payload) => {
            console.log('Import progress update:', payload);
            setProgress(prev => ({
              ...prev,
              message: `Imported ${payload.new.total_imported} games for ${payload.new.username}`
            }));
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
          setIsConnected(status === 'SUBSCRIBED');
        });

      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          setIsConnected(false);
        }
      };
    }
  }, [progress.status]);

  // Fetch import history
  useEffect(() => {
    fetchImportHistory();
  }, []);

  const fetchImportHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('v_import_stats')
        .select('*');

      if (error) {
        console.error('Error fetching import history:', error);
        return;
      }

      setImportHistory(data || []);
    } catch (error) {
      console.error('Error in fetchImportHistory:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim()) {
      setProgress({
        status: 'error',
        message: 'Please enter a username',
        gamesImported: 0,
        totalGames: 0,
        errors: ['Username is required']
      });
      return;
    }

    // Reset progress
    setProgress({
      status: 'fetching',
      message: 'Initializing import...',
      gamesImported: 0,
      totalGames: formData.limit,
      errors: []
    });
    setLiveScores([]);

    try {
      // Call the Edge Function
      const response = await fetch(`${supabaseUrl}/functions/v1/import-games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token || 'demo-token'}`,
        },
        body: JSON.stringify({
          site: formData.site,
          username: formData.username,
          limit: formData.limit
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      setProgress(prev => ({
        ...prev,
        status: 'processing',
        message: `Fetching games from ${formData.site}...`
      }));

      const result = await response.json();
      
      // Wait a moment for any final scores to come through
      setTimeout(() => {
        setProgress({
          status: 'completed',
          message: `Successfully imported ${result.imported} games for ${formData.username}`,
          gamesImported: result.imported,
          totalGames: result.total_fetched,
          errors: result.errors || []
        });
        
        // Refresh import history
        fetchImportHistory();
      }, 2000);

    } catch (error) {
      setProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Import failed',
        gamesImported: 0,
        totalGames: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    }
  };

  const resetForm = () => {
    setFormData({
      site: 'chess.com',
      username: '',
      limit: 50
    });
    setProgress({
      status: 'idle',
      message: '',
      gamesImported: 0,
      totalGames: 0,
      errors: []
    });
    setLiveScores([]);
  };

  const getProgressPercentage = () => {
    if (progress.totalGames === 0) return 0;
    return Math.min((progress.gamesImported / progress.totalGames) * 100, 100);
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'idle':
        return <Play className="w-5 h-5 text-blue-600" />;
      case 'fetching':
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'fetching':
      case 'processing':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          to="/dashboard"
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Import Chess Games</h1>
          <p className="text-gray-600">Fetch and analyze games from Chess.com and Lichess with live progress tracking</p>
        </div>
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <div className="flex items-center space-x-2 text-green-600">
              <Wifi className="w-4 h-4" />
              <span className="text-sm font-medium">Live Connected</span>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-gray-400">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm">Offline</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Import Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Import Configuration</h3>
                <p className="text-sm text-gray-600">Configure your game import settings</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chess Platform
                </label>
                <select
                  value={formData.site}
                  onChange={(e) => setFormData({ ...formData, site: e.target.value as 'chess.com' | 'lichess' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={progress.status === 'processing' || progress.status === 'fetching'}
                >
                  <option value="chess.com">Chess.com</option>
                  <option value="lichess">Lichess</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g., hikaru, magnuscarlsen"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={progress.status === 'processing' || progress.status === 'fetching'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Game Limit
                </label>
                <input
                  type="number"
                  value={formData.limit}
                  onChange={(e) => setFormData({ ...formData, limit: parseInt(e.target.value) })}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={progress.status === 'processing' || progress.status === 'fetching'}
                />
                <p className="text-xs text-gray-500 mt-1">Maximum 100 games per import</p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={progress.status === 'processing' || progress.status === 'fetching' || !formData.username.trim()}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {getStatusIcon()}
                  <span>
                    {progress.status === 'processing' || progress.status === 'fetching' ? 'Importing...' : 'Start Import'}
                  </span>
                </button>
                
                {(progress.status === 'completed' || progress.status === 'error') && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>

            {/* Edge Function Info */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <Cloud className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Edge Function Powered</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Secure, rate-limited imports with duplicate detection and resumable progress tracking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress & Live Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Status */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Import Progress</h3>
              {isConnected && progress.status === 'processing' && (
                <div className="flex items-center space-x-2 text-green-600">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm font-medium">Live Updates</span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Games Processed</span>
                <span>{progress.gamesImported} / {progress.totalGames}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
            </div>

            {/* Status Message */}
            {progress.message && (
              <div className={`p-3 rounded-md border ${getStatusColor()}`}>
                <div className="flex items-center space-x-2">
                  {getStatusIcon()}
                  <span className="text-sm font-medium">{progress.message}</span>
                </div>
              </div>
            )}

            {/* Errors */}
            {progress.errors.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <h4 className="text-sm font-medium text-red-900 mb-2">Errors Encountered:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {progress.errors.slice(0, 5).map((error, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </li>
                  ))}
                  {progress.errors.length > 5 && (
                    <li className="text-red-600">... and {progress.errors.length - 5} more errors</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Live Score Stream */}
          {liveScores.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">🔴 Live Analysis Stream</h3>
                <div className="flex items-center space-x-2 text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Live</span>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {liveScores.map((score, index) => (
                  <div 
                    key={score.id} 
                    className={`p-3 rounded-lg border transition-all duration-300 ${
                      index === 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-gray-900">
                          Game Analysis Complete
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(score.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          score.suspicion_level >= 70 ? 'bg-red-500 text-white' :
                          score.suspicion_level >= 40 ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'
                        }`}>
                          {score.suspicion_level}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import History */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Statistics</h3>
            
            {importHistory.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {importHistory.filter(stat => stat.site !== 'TOTAL').map((stat) => (
                  <div key={stat.site} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`w-3 h-3 rounded-full ${
                        stat.site === 'Chess.com' ? 'bg-blue-500' : 'bg-purple-500'
                      }`}></div>
                      <h4 className="font-medium text-gray-900">{stat.site}</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Players:</span>
                        <span className="font-medium">{stat.unique_players}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Games:</span>
                        <span className="font-medium">{stat.total_games_imported}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Sessions:</span>
                        <span className="font-medium">{stat.import_sessions}</span>
                      </div>
                      {stat.most_recent_import && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Last Import:</span>
                          <span className="font-medium">
                            {new Date(stat.most_recent_import).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No import history yet</p>
                <p className="text-sm">Start your first import to see statistics here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Import;