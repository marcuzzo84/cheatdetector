import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, AlertTriangle, CheckCircle, Clock, Loader2, Wifi, Database, Lock } from 'lucide-react';
import { useLiveSuspiciousScores } from '../hooks/useLiveQueries';
import { useAuth } from '../contexts/AuthContext';

const LiveSuspiciousScoresTable: React.FC = () => {
  const { scores, loading, error } = useLiveSuspiciousScores();
  const { userProfile, isAdmin } = useAuth();
  
  // Check if user has premium access
  const hasPremiumAccess = isAdmin || userProfile?.role === 'premium' || userProfile?.role === 'pro';

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

  const getSiteBadge = (site: string) => {
    const isChessCom = site === 'Chess.com';
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
        isChessCom ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
      }`}>
        {site}
      </span>
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getChessComUrl = (playerHash: string) => {
    return `https://www.chess.com/member/${playerHash.substring(0, 8)}`;
  };

  const getLichessUrl = (playerHash: string) => {
    return `https://lichess.org/@/${playerHash.substring(0, 8)}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">🚨 Latest high-risk games</h3>
              <p className="text-sm text-gray-600">Games with suspicion level ≥ 80%</p>
            </div>
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              <span className="text-sm text-gray-500">Loading...</span>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex space-x-4">
                <div className="w-24 h-4 bg-gray-200 rounded"></div>
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
                <div className="w-12 h-4 bg-gray-200 rounded"></div>
                <div className="w-32 h-4 bg-gray-200 rounded"></div>
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
                <div className="w-20 h-4 bg-gray-200 rounded"></div>
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">🚨 Latest high-risk games</h3>
        </div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">Error loading suspicious scores: {error}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900">🚨 Latest high-risk games</h3>
              {!hasPremiumAccess && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  <Lock className="w-3 h-3 mr-1" />
                  Limited in Free Plan
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">Games with suspicion level ≥ 80% ({scores.length} found)</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-green-600">
              <Wifi className="w-4 h-4" />
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <span className="text-sm text-gray-500">Live updates</span>
          </div>
        </div>
      </div>
      
      {scores.length === 0 && (
        <div className="p-6 text-center">
          <div className="text-gray-400 mb-2">
            <Database className="w-8 h-8 mx-auto" />
          </div>
          <p className="text-gray-600">No high-risk games found</p>
          <p className="text-sm text-gray-500 mt-1">Import some games to see suspicious activity</p>
        </div>
      )}

      {scores.length > 0 && (
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
                  Elo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Engine Match
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ML Prob
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Suspicion
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {scores.slice(0, hasPremiumAccess ? scores.length : 3).map((score) => (
                <tr key={score.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link 
                      to={`/players/${score.player_hash}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 font-mono"
                    >
                      {score.player_hash.substring(0, 12)}...
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSiteBadge(score.site)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {score.elo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {score.match_engine_pct?.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {score.ml_prob?.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="w-full bg-gray-200 rounded-full h-2 w-16">
                        <div 
                          className="h-2 rounded-full bg-red-500"
                          style={{ width: `${score.suspicion_level}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-900 min-w-8 font-bold text-red-600">
                        {score.suspicion_level}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTime(score.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col space-y-1">
                      <div className="flex space-x-2">
                        <Link
                          to={`/players/${score.player_hash}`}
                          className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Link>
                      </div>
                      <div className="flex space-x-2">
                        <a
                          href={getChessComUrl(score.player_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 inline-flex items-center text-xs"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Chess.com
                        </a>
                        <a
                          href={getLichessUrl(score.player_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-800 inline-flex items-center text-xs"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Lichess
                        </a>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upgrade Banner for Free Users */}
      {!hasPremiumAccess && scores.length > 3 && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-t border-blue-200">
          <div className="flex items-start space-x-3">
            <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Premium Feature</h4>
              <p className="text-sm text-blue-700 mt-1">
                <strong>{scores.length - 3} more high-risk games</strong> are available with Premium or Pro subscription.
                Upgrade to see all suspicious games and get access to advanced analytics.
              </p>
              <button className="mt-2 inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveSuspiciousScoresTable;