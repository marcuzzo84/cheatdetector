import React, { useState } from 'react';
import { X, Download, Users, AlertCircle, CheckCircle, Loader2, Database, Globe, Zap, Cloud } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DataImportModal: React.FC<DataImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'demo' | 'edge'>('edge');
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

  // Edge function import
  const [edgeImport, setEdgeImport] = useState({
    username: '',
    site: 'chess.com' as 'chess.com' | 'lichess',
    limit: 50
  });

  // Batch import
  const [batchPlayers, setBatchPlayers] = useState('');
  const [batchLimit, setBatchLimit] = useState(25);

  const handleEdgeFunctionImport = async () => {
    if (!edgeImport.username.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError('');
    setProgress('Calling Supabase Edge Function...');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/import-games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token || 'demo-token'}`,
        },
        body: JSON.stringify({
          site: edgeImport.site,
          username: edgeImport.username,
          limit: edgeImport.limit
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      setSuccess(`Successfully imported ${result.imported} games for ${edgeImport.username} from ${edgeImport.site}`);
      if (result.errors && result.errors.length > 0) {
        setError(`Some errors occurred: ${result.errors.slice(0, 3).join(', ')}`);
      }
      setProgress('');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import via Edge Function');
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
    setProgress('Importing demo data via Edge Functions...');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      let totalImported = 0;
      const errors: string[] = [];

      for (let i = 0; i < demoPlayers.length; i++) {
        const player = demoPlayers[i];
        setProgress(`Importing ${player.username} (${i + 1}/${demoPlayers.length})...`);

        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/import-games`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user?.access_token || 'demo-token'}`,
            },
            body: JSON.stringify({
              site: player.site,
              username: player.username,
              limit: 20
            })
          });

          if (response.ok) {
            const result = await response.json();
            totalImported += result.imported;
          } else {
            const errorData = await response.json();
            errors.push(`${player.username}: ${errorData.error}`);
          }
        } catch (err) {
          errors.push(`${player.username}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }

        // Add delay between requests
        if (i < demoPlayers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      setSuccess(`Successfully imported ${totalImported} games from ${demoPlayers.length} top players`);
      if (errors.length > 0) {
        setError(`Some imports failed: ${errors.slice(0, 3).join(', ')}`);
      }
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
    setEdgeImport({ username: '', site: 'chess.com', limit: 50 });
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
              onClick={() => setActiveTab('edge')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'edge'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span>Edge Function</span>
            </button>
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

          {/* Edge Function Tab */}
          {activeTab === 'edge' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <Cloud className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Supabase Edge Function Import</h4>
                    <p className="text-gray-600 mb-4">
                      Use our serverless Edge Function for secure, rate-limited imports with proper authentication.
                      This method includes duplicate detection, resumable imports, and automatic cursor tracking.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Rate Limited & Secure</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Duplicate Prevention</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Resumable Imports</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Production Ready</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={edgeImport.username}
                    onChange={(e) => setEdgeImport({ ...edgeImport, username: e.target.value })}
                    placeholder="e.g., hikaru, magnuscarlsen"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site
                  </label>
                  <select
                    value={edgeImport.site}
                    onChange={(e) => setEdgeImport({ ...edgeImport, site: e.target.value as 'chess.com' | 'lichess' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="chess.com">Chess.com</option>
                    <option value="lichess">Lichess</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Game Limit
                  </label>
                  <input
                    type="number"
                    value={edgeImport.limit}
                    onChange={(e) => setEdgeImport({ ...edgeImport, limit: parseInt(e.target.value) })}
                    min="1"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-green-800">Production-Ready Import</h4>
                    <p className="text-sm text-green-700 mt-1">
                      This Edge Function handles authentication, rate limiting, duplicate detection, and cursor tracking automatically.
                      Perfect for production use with proper error handling and resumable imports.
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
                  onClick={handleEdgeFunctionImport}
                  disabled={loading || !edgeImport.username.trim()}
                  className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                  <span>{loading ? 'Importing...' : 'Import via Edge Function'}</span>
                </button>
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
                      Import games from top chess players using Edge Functions to quickly populate your dashboard with realistic data.
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
                        <Cloud className="w-4 h-4 text-orange-500" />
                        <span>Edge Function Powered</span>
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
        </div>
      </div>
    </div>
  );
};

export default DataImportModal;