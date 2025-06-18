import React, { useState } from 'react';
import { X, Download, Users, AlertTriangle, CheckCircle, Loader2, Database, Globe, Zap, Cloud, Crown, FileText, Lock, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PGNImportModal from './PGNImportModal';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Live import state
  const [liveImport, setLiveImport] = useState({
    username: '',
    site: 'chess.com' as 'chess.com' | 'lichess',
    limit: 50
  });

  // Check if user has premium access (admin or specific role)
  const hasPremiumAccess = isAdmin || userProfile?.role === 'premium' || userProfile?.role === 'pro';
  const userTier = userProfile?.role || 'free';

  const handleLiveImport = async () => {
    if (!hasPremiumAccess) {
      setShowUpgradeModal(true);
      return;
    }

    if (!liveImport.username.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError('');
    setProgress('Connecting to Chess.com/Lichess API...');

    try {
      console.log('=== Starting Live Import ===');
      console.log('Import config:', liveImport);
      console.log('User:', user?.id);
      console.log('Supabase URL:', supabaseUrl);

      // Get authentication token
      let authToken = 'demo-token';
      let authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      };

      if (user) {
        try {
          console.log('Getting fresh session...');
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (session?.access_token && !sessionError) {
            authToken = session.access_token;
            authHeaders['Authorization'] = `Bearer ${authToken}`;
            console.log('Using authenticated session token');
          } else {
            console.log('Session error or no token:', sessionError?.message);
            // Continue with demo mode
            authHeaders['Authorization'] = `Bearer demo-token`;
          }
        } catch (sessionError) {
          console.warn('Failed to get session, using demo mode:', sessionError);
          authHeaders['Authorization'] = `Bearer demo-token`;
        }
      } else {
        console.log('No user, using demo mode');
        authHeaders['Authorization'] = `Bearer demo-token`;
      }

      console.log('Request headers:', authHeaders);

      const requestBody = {
        site: liveImport.site,
        username: liveImport.username,
        limit: liveImport.limit
      };

      console.log('Request body:', requestBody);

      setProgress('Calling Edge Function...');

      const response = await fetch(`${supabaseUrl}/functions/v1/import-games`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      // Get response text first to handle both JSON and text responses
      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
          console.error('Parsed error:', errorData);
        } catch (parseError) {
          errorMessage = responseText || errorMessage;
          console.error('Raw error response:', responseText);
        }
        
        throw new Error(errorMessage);
      }

      // Parse successful response
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Parsed result:', result);
      } catch (parseError) {
        console.error('Failed to parse success response:', responseText);
        throw new Error('Invalid response format from server');
      }
      
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
      console.error('=== Import Error ===');
      console.error('Error:', err);
      
      let errorMessage = 'Failed to import via API';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      // Provide more helpful error messages
      if (errorMessage.includes('401')) {
        errorMessage = 'Authentication failed. Please try signing out and signing back in.';
      } else if (errorMessage.includes('404')) {
        errorMessage = 'Player not found on the selected chess platform.';
      } else if (errorMessage.includes('500')) {
        errorMessage = 'Server error. Please try again in a few moments.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      setError(errorMessage);
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoDataImport = async () => {
    if (!hasPremiumAccess) {
      setShowUpgradeModal(true);
      return;
    }

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
      let totalImported = 0;
      const errors: string[] = [];

      // Get authentication headers
      let authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': 'Bearer demo-token'
      };

      if (user) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            authHeaders['Authorization'] = `Bearer ${session.access_token}`;
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
            headers: authHeaders,
            body: JSON.stringify({
              site: player.site,
              username: player.username,
              limit: 20
            })
          });

          const responseText = await response.text();
          
          if (response.ok) {
            try {
              const result = JSON.parse(responseText);
              if (result.success) {
                totalImported += result.imported;
              } else {
                errors.push(`${player.username}: ${result.error}`);
              }
            } catch (parseError) {
              errors.push(`${player.username}: Invalid response format`);
            }
          } else {
            try {
              const errorData = JSON.parse(responseText);
              errors.push(`${player.username}: ${errorData.error}`);
            } catch (parseError) {
              errors.push(`${player.username}: HTTP ${response.status}`);
            }
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

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'admin':
      case 'administrator':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <Crown className="w-3 h-3 mr-1" />
            Admin
          </span>
        );
      case 'premium':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gold-100 text-gold-800">
            <Star className="w-3 h-3 mr-1" />
            Premium
          </span>
        );
      case 'pro':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Zap className="w-3 h-3 mr-1" />
            Pro
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Free
          </span>
        );
    }
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
              <div className="flex items-center space-x-3">
                {getTierBadge(userTier)}
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Subscription Status Banner */}
            {!hasPremiumAccess && (
              <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900">Upgrade for Full Access</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      You're currently on the <strong>Free</strong> plan. Upgrade to <strong>Premium</strong> or <strong>Pro</strong> to unlock live API imports, advanced analytics, and priority support.
                    </p>
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="mt-2 inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Crown className="w-3 h-3 mr-1" />
                      View Plans
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
              <button
                onClick={() => setActiveTab('live')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors relative ${
                  activeTab === 'live'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Cloud className="w-4 h-4" />
                <span>Live Import</span>
                {!hasPremiumAccess && <Lock className="w-3 h-3 text-orange-500" />}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  hasPremiumAccess ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {hasPremiumAccess ? 'API' : 'Premium'}
                </span>
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
                <div className={`bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 ${!hasPremiumAccess ? 'opacity-75' : ''}`}>
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center relative">
                      <Cloud className="w-6 h-6 text-white" />
                      {!hasPremiumAccess && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                          <Lock className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">Live API Import</h4>
                        {!hasPremiumAccess && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            <Crown className="w-3 h-3 mr-1" />
                            Premium Feature
                          </span>
                        )}
                      </div>
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

                {!hasPremiumAccess && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Lock className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-orange-900">Premium Feature Required</h4>
                        <p className="text-sm text-orange-700 mt-1">
                          Live API import is available for Premium and Pro subscribers. This feature provides:
                        </p>
                        <ul className="text-sm text-orange-700 mt-2 space-y-1">
                          <li>• Direct API access to Chess.com and Lichess</li>
                          <li>• Automatic game fetching and analysis</li>
                          <li>• Real-time duplicate detection</li>
                          <li>• Priority processing and support</li>
                        </ul>
                        <button
                          onClick={() => setShowUpgradeModal(true)}
                          className="mt-3 inline-flex items-center px-3 py-1 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm"
                        >
                          <Crown className="w-3 h-3 mr-1" />
                          Upgrade Now
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${!hasPremiumAccess ? 'opacity-50 pointer-events-none' : ''}`}>
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
                      disabled={loading || !hasPremiumAccess}
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
                      disabled={loading || !hasPremiumAccess}
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
                      disabled={loading || !hasPremiumAccess}
                    />
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
                    disabled={loading || (!hasPremiumAccess || !liveImport.username.trim())}
                    className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50"
                  >
                    {!hasPremiumAccess ? (
                      <Lock className="w-4 h-4" />
                    ) : loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Cloud className="w-4 h-4" />
                    )}
                    <span>
                      {!hasPremiumAccess ? 'Premium Required' : loading ? 'Importing...' : 'Import via Live API'}
                    </span>
                  </button>
                  <button
                    onClick={handleDemoDataImport}
                    disabled={loading || !hasPremiumAccess}
                    className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-md hover:from-green-700 hover:to-blue-700 transition-colors disabled:opacity-50"
                  >
                    {!hasPremiumAccess ? (
                      <Lock className="w-4 h-4" />
                    ) : loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    <span>
                      {!hasPremiumAccess ? 'Premium Required' : loading ? 'Importing...' : 'Import Demo Data'}
                    </span>
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
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">PGN File Import</h4>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Free Feature
                        </span>
                      </div>
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
                      <div className="flex items-center space-x-2 mb-2">
                        <p className="font-medium text-blue-700">⚡ Live API Import</p>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          <Crown className="w-3 h-3 mr-1" />
                          Premium
                        </span>
                      </div>
                      <ul className="text-gray-600 space-y-1">
                        <li>• Direct API integration</li>
                        <li>• Real-time game fetching</li>
                        <li>• Advanced analysis features</li>
                        <li>• Automatic updates</li>
                        <li>• Rate limiting handled</li>
                      </ul>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <p className="font-medium text-green-700">✓ PGN Upload</p>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Free
                        </span>
                      </div>
                      <ul className="text-gray-600 space-y-1">
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

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-3xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Upgrade Your Plan</h3>
                    <p className="text-sm text-gray-600">Unlock premium features and advanced analytics</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Free Plan */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="text-center">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Free</h4>
                    <div className="text-3xl font-bold text-gray-900 mb-4">$0<span className="text-sm font-normal text-gray-500">/month</span></div>
                    <div className="space-y-3 text-sm text-gray-600">
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>PGN file uploads</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Basic analysis</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Up to 100 games/month</span>
                      </div>
                      <div className="flex items-center">
                        <X className="w-4 h-4 text-gray-400 mr-2" />
                        <span>Live API imports</span>
                      </div>
                      <div className="flex items-center">
                        <X className="w-4 h-4 text-gray-400 mr-2" />
                        <span>Advanced analytics</span>
                      </div>
                    </div>
                    <div className="mt-6">
                      <span className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium">
                        Current Plan
                      </span>
                    </div>
                  </div>
                </div>

                {/* Premium Plan */}
                <div className="border-2 border-blue-500 rounded-lg p-6 relative">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">Most Popular</span>
                  </div>
                  <div className="text-center">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Premium</h4>
                    <div className="text-3xl font-bold text-gray-900 mb-4">$9<span className="text-sm font-normal text-gray-500">/month</span></div>
                    <div className="space-y-3 text-sm text-gray-600">
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Everything in Free</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Live API imports</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Up to 1,000 games/month</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Advanced analytics</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Priority support</span>
                      </div>
                    </div>
                    <div className="mt-6">
                      <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium">
                        Upgrade to Premium
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pro Plan */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="text-center">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Pro</h4>
                    <div className="text-3xl font-bold text-gray-900 mb-4">$19<span className="text-sm font-normal text-gray-500">/month</span></div>
                    <div className="space-y-3 text-sm text-gray-600">
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Everything in Premium</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Unlimited games</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>Custom analysis models</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>API access</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        <span>White-label options</span>
                      </div>
                    </div>
                    <div className="mt-6">
                      <button className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors font-medium">
                        Upgrade to Pro
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  All plans include a 14-day free trial. Cancel anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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