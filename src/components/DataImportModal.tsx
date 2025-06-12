import React, { useState } from 'react';
import { X, Download, Users, AlertCircle, CheckCircle, Loader2, Database, Globe, Zap } from 'lucide-react';
import { chessApiService } from '../services/chessApiService';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DataImportModal: React.FC<DataImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'demo'>('demo');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Single player import
  const [singlePlayer, setSinglePlayer] = useState({
    username: '',
    site: 'both' as 'chess.com' | 'lichess' | 'both',
    limit: 50
  });

  // Batch import
  const [batchPlayers, setBatchPlayers] = useState('');
  const [batchLimit, setBatchLimit] = useState(25);

  const handleSinglePlayerImport = async () => {
    if (!singlePlayer.username.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError('');
    setProgress('Fetching player data...');

    try {
      const gameCount = await chessApiService.fetchAndStorePlayerData(
        singlePlayer.username,
        singlePlayer.site,
        singlePlayer.limit
      );

      setSuccess(`Successfully imported ${gameCount} games for ${singlePlayer.username}`);
      setProgress('');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import player data');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchImport = async () => {
    const players = batchPlayers
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const [username, site] = line.split(',').map(s => s.trim());
        return {
          username,
          site: (site as 'chess.com' | 'lichess' | 'both') || 'both'
        };
      });

    if (players.length === 0) {
      setError('Please enter at least one player');
      return;
    }

    setLoading(true);
    setError('');
    setProgress(`Starting batch import for ${players.length} players...`);

    try {
      await chessApiService.fetchMultiplePlayersData(players, batchLimit);
      setSuccess(`Successfully completed batch import for ${players.length} players`);
      setProgress('');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete batch import');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoDataImport = async () => {
    const demoPlayers = [
      { username: 'hikaru', site: 'chess.com' as const },
      { username: 'magnuscarlsen', site: 'chess.com' as const },
      { username: 'penguingm1', site: 'lichess' as const },
      { username: 'DrNykterstein', site: 'lichess' as const },
      { username: 'nihalsarin', site: 'chess.com' as const }
    ];

    setLoading(true);
    setError('');
    setProgress('Importing demo data from top players...');

    try {
      await chessApiService.fetchMultiplePlayersData(demoPlayers, 20);
      setSuccess(`Successfully imported demo data from ${demoPlayers.length} top players`);
      setProgress('');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import demo data');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSinglePlayer({ username: '', site: 'both', limit: 50 });
    setBatchPlayers('');
    setBatchLimit(25);
    setError('');
    setSuccess('');
    setProgress('');
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Import Chess Game Data</h3>
                <p className="text-sm text-gray-600">Fetch real games from Chess.com and Lichess APIs</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
            <button
              onClick={() => setActiveTab('demo')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'demo'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Demo Data</span>
            </button>
            <button
              onClick={() => setActiveTab('single')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'single'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Single Player</span>
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'batch'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Batch Import</span>
            </button>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-sm text-green-700">{success}</span>
              </div>
            </div>
          )}

          {progress && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-center">
                <Loader2 className="w-4 h-4 text-blue-500 mr-2 animate-spin" />
                <span className="text-sm text-blue-700">{progress}</span>
              </div>
            </div>
          )}

          {/* Demo Data Tab */}
          {activeTab === 'demo' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Quick Demo Setup</h4>
                    <p className="text-gray-600 mb-4">
                      Import games from top chess players to quickly populate your dashboard with realistic data.
                      This will fetch recent games from players like Hikaru, Magnus Carlsen, and other top GMs.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Globe className="w-4 h-4 text-blue-500" />
                        <span>Chess.com & Lichess</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-green-500" />
                        <span>5 Top Players</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Database className="w-4 h-4 text-purple-500" />
                        <span>~100 Games Total</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 text-orange-500" />
                        <span>~2-3 minutes</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDemoDataImport}
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  <span>{loading ? 'Importing...' : 'Import Demo Data'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Single Player Tab */}
          {activeTab === 'single' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={singlePlayer.username}
                    onChange={(e) => setSinglePlayer({ ...singlePlayer, username: e.target.value })}
                    placeholder="e.g., hikaru, magnuscarlsen"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site
                  </label>
                  <select
                    value={singlePlayer.site}
                    onChange={(e) => setSinglePlayer({ ...singlePlayer, site: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="both">Both Chess.com & Lichess</option>
                    <option value="chess.com">Chess.com only</option>
                    <option value="lichess">Lichess only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Game Limit
                  </label>
                  <input
                    type="number"
                    value={singlePlayer.limit}
                    onChange={(e) => setSinglePlayer({ ...singlePlayer, limit: parseInt(e.target.value) })}
                    min="1"
                    max="200"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Rate Limiting Notice</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Chess.com API has a rate limit of 1 request per second. Importing large amounts of data may take several minutes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSinglePlayerImport}
                  disabled={loading || !singlePlayer.username.trim()}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{loading ? 'Importing...' : 'Import Player'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Batch Import Tab */}
          {activeTab === 'batch' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Player List
                </label>
                <textarea
                  value={batchPlayers}
                  onChange={(e) => setBatchPlayers(e.target.value)}
                  placeholder={`Enter one player per line, optionally with site:
hikaru, chess.com
magnuscarlsen, chess.com
penguingm1, lichess
DrNykterstein, lichess
player5`}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format: username, site (optional). If no site specified, both Chess.com and Lichess will be checked.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Games per Player
                </label>
                <input
                  type="number"
                  value={batchLimit}
                  onChange={(e) => setBatchLimit(parseInt(e.target.value))}
                  min="1"
                  max="100"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Batch Import Warning</h4>
                    <p className="text-sm text-red-700 mt-1">
                      Batch imports can take a very long time due to API rate limits. Consider using smaller batches or the demo data option for testing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchImport}
                  disabled={loading || !batchPlayers.trim()}
                  className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  <span>{loading ? 'Importing...' : 'Start Batch Import'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataImportModal;