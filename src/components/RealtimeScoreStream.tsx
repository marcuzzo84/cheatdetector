import React, { useState } from 'react';
import { Wifi, WifiOff, Shield, AlertTriangle, CheckCircle, Eye, ExternalLink } from 'lucide-react';
import { useRealtimeScores, type ScoreWithPlayer } from '../hooks/useRealtimeScores';
import { Link } from 'react-router-dom';

const RealtimeScoreStream: React.FC = () => {
  const { 
    isConnected, 
    isAuthenticated, 
    latestScore, 
    connectionError, 
    authenticate, 
    signOut 
  } = useRealtimeScores();
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [email, setEmail] = useState('admin@fairplay-scout.com');
  const [password, setPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    
    const success = await authenticate(email, password);
    if (success) {
      setShowAuthModal(false);
      setPassword('');
    }
    
    setIsAuthenticating(false);
  };

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
          <Eye className="w-3 h-3 mr-1" />
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  const getChessComUrl = (playerHash: string) => {
    return `https://www.chess.com/member/${playerHash.substring(0, 8)}`;
  };

  const getLichessUrl = (playerHash: string) => {
    return `https://lichess.org/@/${playerHash.substring(0, 8)}`;
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900">🔴 Live Score Stream</h3>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <Wifi className="w-4 h-4" />
                  <span className="text-sm font-medium">Connected</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-red-600">
                  <WifiOff className="w-4 h-4" />
                  <span className="text-sm font-medium">Disconnected</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 text-green-600">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">Authenticated</span>
                </div>
                <button
                  onClick={signOut}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                <Shield className="w-4 h-4" />
                <span>Authenticate</span>
              </button>
            )}
          </div>
        </div>

        {connectionError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700">{connectionError}</span>
            </div>
          </div>
        )}

        {!isAuthenticated && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-yellow-600" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Authentication Required</h4>
                <p className="text-sm text-yellow-700">Please authenticate to receive real-time score updates.</p>
              </div>
            </div>
          </div>
        )}

        {isAuthenticated && isConnected && !latestScore && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <Wifi className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-gray-600">Waiting for new game analysis results...</p>
            <p className="text-sm text-gray-500 mt-1">Real-time updates will appear here</p>
          </div>
        )}

        {latestScore && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-900">New Analysis Result</span>
                <span className="text-xs text-gray-500">{formatTime(latestScore.created_at)}</span>
              </div>
              {getSuspicionBadge(latestScore.suspicion_level)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Player Information</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Hash:</span>
                    <Link 
                      to={`/players/${latestScore.player.hash}`}
                      className="font-mono text-blue-600 hover:text-blue-800"
                    >
                      {latestScore.player.hash.substring(0, 12)}...
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Elo:</span>
                    <span className="font-medium">{latestScore.player.elo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Site:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      latestScore.game.site === 'Chess.com' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {latestScore.game.site}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Analysis Metrics</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Engine Match:</span>
                    <span className="font-medium">{latestScore.match_engine_pct?.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ML Probability:</span>
                    <span className="font-medium">{latestScore.ml_prob?.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Suspicion Level:</span>
                    <span className={`font-bold ${
                      latestScore.suspicion_level >= 70 ? 'text-red-600' :
                      latestScore.suspicion_level >= 40 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {latestScore.suspicion_level}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/players/${latestScore.player.hash}`}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  <Eye className="w-3 h-3" />
                  <span>View Player</span>
                </Link>
                <a
                  href={getChessComUrl(latestScore.player.hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Chess.com</span>
                </a>
                <a
                  href={getLichessUrl(latestScore.player.hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 px-3 py-1 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors text-sm"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Lichess</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Authenticate for Real-time Updates</h3>
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleAuthenticate} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isAuthenticating ? 'Authenticating...' : 'Sign In'}
                  </button>
                </div>
              </form>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>Demo credentials:</strong><br />
                  Email: admin@fairplay-scout.com<br />
                  Password: (enter any password for demo)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RealtimeScoreStream;