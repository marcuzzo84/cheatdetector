import React, { useState } from 'react';
import { X, Download, Users, AlertTriangle, CheckCircle, Loader2, Database, Globe, Zap, Cloud, Crown, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PGNImportModal from './PGNImportModal';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DataImportModal: React.FC<DataImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, userProfile, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'live' | 'pgn'>('live');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPGNModal, setShowPGNModal] = useState(false);

  // Live import state
  const [liveImport, setLiveImport] = useState({
    username: '',
    site: 'chess.com' as 'chess.com' | 'lichess',
    limit: 50
  });

  // Check if user has premium access (admin or specific role)
  const hasPremiumAccess = isAdmin || userProfile?.role === 'premium';

  const handleLiveImport = async () => {
    if (!liveImport.username.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError('');
    setProgress('Calling Chess.com/Lichess API...');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Get the current session for authentication
      let authToken = 'demo-token';
      
      if (user) {
        // Try to get a fresh session
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            authToken = session.access_token;
            console.log('Using session token for authentication');
          } else {
            console.log('No session token available, using demo mode');
          }
        } catch (sessionError) {
          console.warn('Failed to get session:', sessionError);
        }
      }

      console.log('Making request to Edge Function...');
      
      const response = await fetch(`${supabaseUrl}/functions/v1/import-games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          site: liveImport.site,
          username: liveImport.username,
          limit: liveImport.limit
        })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Import result:', result);
      
      if (result.success) {
        setSuccess(`Successfully imported ${result.imported} games for ${liveImport.username} from ${liveImport.site}`);
        if (result.errors && result.errors.length > 0) {
          console.warn('Import warnings:', result.errors);
          setError(`Some warnings: ${result.errors.slice(0, 3).join(', ')}`);
        }
        setProgress('');
        
        // Call success callback after a short delay
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else {
        throw new Error(result.error || 'Import failed');
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import via API');
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
    setProgress('Importing demo data from Chess.com and Lichess...');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      let totalImported = 0;
      const errors: string[] = [];

      // Get authentication token
      let authToken = 'demo-token';
      if (user) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            authToken = session.access_token;
          }
        } catch (sessionError) {
          console.warn('Failed to get session for demo import:', sessionError);
        }
      }

      for (let i = 0; i < demoPlayers.length; i++) {
        const player = demoPlayers[i];
        setProgress(`Importing ${player.username} from ${player.site} (${i + 1}/${demoPlayers.length})...`);

        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/import-games`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              site: player.site,
              username: player.username,
              limit: 20
            })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              totalImported += result.imported;
            } else {
              errors.push(`${player.username}: ${result.error}`);
            }
          } else {
            const errorData = await response.json();
            errors.push(`${player.username}: ${errorData.error}`);
          }
        } catch (err) {
          errors.push(`${player.username}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }

        // Add delay between requests to respect rate limits
        if (i < demoPlayers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      setSuccess(`Successfully imported ${totalImported} games from ${demoPlayers.length} top players`);
      if (errors.length > 0) {
        setError(`Some imports failed: ${errors.slice(0, 3).join(', ')}`);
      }
      setProgress('');
      
      // Call success callback
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import demo data');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setLiveImport({ username: '', site: 'chess.com', limit: 50 });
    setError('');
    setSuccess('');
    setProgress('');
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePGNSuccess = () => {
    setShowPGNModal(false);
    onSuccess?.();
  };

  if (!isOpen) return null;

  return (
    <>
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
                  <p className="text-sm text-gray-600">Choose your import method based on your subscription</p>
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
                onClick={() => setActiveTab('live')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'live'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Cloud className="w-4 h-4" />
                <span>Live Import</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">API</span>
              </button>
              <button
                onClick={() => setActiveTab('pgn')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'pgn'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>PGN Upload</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Free</span>
              </button>
            </div>

            {/* Status Messages */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-center">
                  <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
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

            {/* Live Import Tab */}
            {activeTab === 'live' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <Cloud className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Live API Import</h4>
                      <p className="text-gray-600 mb-4">
                        Directly fetch games from Chess.com and Lichess APIs with automatic analysis and duplicate detection.
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Real-time Import</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Automatic Analysis</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Duplicate Prevention</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Rate Limited & Secure</span>
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
                      value={liveImport.username}
                      onChange={(e) => setLiveImport({ ...liveImport, username: e.target.value })}
                      placeholder="e.g., hikaru, magnuscarlsen"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Site
                    </label>
                    <select
                      value={liveImport.site}
                      onChange={(e) => setLiveImport({ ...liveImport, site: e.target.value as 'chess.com' | 'lichess' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={loading}
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
                      value={liveImport.limit}
                      onChange={(e) => setLiveImport({ ...liveImport, limit: parseInt(e.target.value) })}
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={loading}
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
                    onClick={handleLiveImport}
                    disabled={loading || !liveImport.username.trim()}
                    className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Cloud className="w-4 h-4" />
                    )}
                    <span>{loading ? 'Importing...' : 'Import via Live API'}</span>
                  </button>
                  <button
                    onClick={handleDemoDataImport}
                    disabled={loading}
                    className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-md hover:from-green-700 hover:to-blue-700 transition-colors disabled:opacity-50"
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

            {/* PGN Upload Tab */}
            {activeTab === 'pgn' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-gray-900 mb-2">PGN File Import</h4>
                      <p className="text-gray-600 mb-4">
                        Upload your chess games from PGN files downloaded from Chess.com or Lichess. 
                        Perfect for analyzing your personal game history with our anti-cheat detection system.
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Upload any PGN file</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>No API rate limits</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Batch game processing</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Free for all users</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">How to get your PGN files:</h4>
                      <div className="mt-2 space-y-2 text-sm text-blue-700">
                        <div>
                          <strong>Chess.com:</strong> Go to your profile → Games → Download games → Select date range → Download PGN
                        </div>
                        <div>
                          <strong>Lichess:</strong> Go to your profile → Export games → Select format (PGN) → Download
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
                    onClick={() => setShowPGNModal(true)}
                    disabled={loading}
                    className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Upload PGN File</span>
                  </button>
                </div>
              </div>
            )}

            {/* Feature Comparison */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start space-x-3">
                <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Import Method Comparison</h4>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-blue-700">⚡ Live API Import</p>
                      <ul className="text-gray-600 mt-1 space-y-1">
                        <li>• Direct API integration</li>
                        <li>• Real-time game fetching</li>
                        <li>• Advanced analysis features</li>
                        <li>• Automatic updates</li>
                        <li>• Rate limiting handled</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-green-700">✓ PGN Upload (Free)</p>
                      <ul className="text-gray-600 mt-1 space-y-1">
                        <li>• Upload your own game files</li>
                        <li>• Works with any PGN file</li>
                        <li>• No API rate limits</li>
                        <li>• Basic analysis included</li>
                        <li>• Available to all users</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PGN Import Modal */}
      <PGNImportModal
        isOpen={showPGNModal}
        onClose={() => setShowPGNModal(false)}
        onSuccess={handlePGNSuccess}
      />
    </>
  );
};

export default DataImportModal;