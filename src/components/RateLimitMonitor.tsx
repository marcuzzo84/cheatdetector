import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Zap, Database, Wifi, Lock, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface RateLimitStatus {
  site: 'chess.com' | 'lichess';
  requestsUsed: number;
  requestsLimit: number;
  dataUsed: number;
  dataLimit: number;
  resetTime: number;
  healthy: boolean;
  recommendations: string[];
}

interface RateLimitMonitorProps {
  onStatusChange?: (status: RateLimitStatus[]) => void;
}

const RateLimitMonitor: React.FC<RateLimitMonitorProps> = ({ onStatusChange }) => {
  const { userProfile, isAdmin } = useAuth();
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Check if user has premium access
  const hasPremiumAccess = isAdmin || userProfile?.role === 'premium' || userProfile?.role === 'pro';

  useEffect(() => {
    fetchRateLimitStatus();
    
    // Update every 30 seconds
    const interval = setInterval(fetchRateLimitStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchRateLimitStatus = async () => {
    try {
      // This would call your enhanced API service
      const mockStatus: RateLimitStatus[] = [
        {
          site: 'chess.com',
          requestsUsed: 45,
          requestsLimit: hasPremiumAccess ? 3600 : 600,
          dataUsed: 2.1 * 1024 * 1024, // 2.1 MB
          dataLimit: hasPremiumAccess ? 10 * 1024 * 1024 : 2 * 1024 * 1024, // 10 MB for premium, 2 MB for free
          resetTime: Date.now() + 3600000,
          healthy: true,
          recommendations: []
        },
        {
          site: 'lichess',
          requestsUsed: 234,
          requestsLimit: hasPremiumAccess ? 54000 : 10000,
          dataUsed: 3.8 * 1024 * 1024, // 3.8 MB
          dataLimit: hasPremiumAccess ? 5 * 1024 * 1024 : 1 * 1024 * 1024, // 5 MB for premium, 1 MB for free
          resetTime: Date.now() + 60000,
          healthy: true,
          recommendations: hasPremiumAccess ? [] : ['Upgrade to Premium for higher limits']
        }
      ];

      setRateLimitStatus(mockStatus);
      setLastUpdate(new Date());
      onStatusChange?.(mockStatus);
    } catch (error) {
      console.error('Failed to fetch rate limit status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthIcon = (healthy: boolean) => {
    return healthy ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <AlertTriangle className="w-4 h-4 text-red-500" />
    );
  };

  const getUsageColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTimeRemaining = (resetTime: number) => {
    const remaining = resetTime - Date.now();
    if (remaining <= 0) return 'Resetting...';
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="w-5 h-5 text-blue-600 animate-spin" />
          <h3 className="text-lg font-semibold text-gray-900">Rate Limit Monitor</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-gray-500">Loading rate limit status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">API Rate Limits</h3>
          {!hasPremiumAccess && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              <Lock className="w-3 h-3 mr-1" />
              Limited in Free Plan
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Wifi className="w-4 h-4" />
          <span>Last updated: {lastUpdate?.toLocaleTimeString()}</span>
        </div>
      </div>

      {!hasPremiumAccess && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Star className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Premium Rate Limits Available</h4>
              <p className="text-sm text-blue-700 mt-1">
                Upgrade to <strong>Premium</strong> or <strong>Pro</strong> to get higher API rate limits:
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• 6x higher request limits on Chess.com API</li>
                <li>• 5x higher request limits on Lichess API</li>
                <li>• 5x higher data transfer allowance</li>
                <li>• Priority API access during peak times</li>
              </ul>
              <button className="mt-3 inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
                <Star className="w-3 h-3 mr-1" />
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {rateLimitStatus.map((status) => (
          <div key={status.site} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  status.site === 'chess.com' ? 'bg-blue-500' : 'bg-purple-500'
                }`}></div>
                <h4 className="font-medium text-gray-900 capitalize">{status.site}</h4>
                {getHealthIcon(status.healthy)}
              </div>
              <div className="text-sm text-gray-500">
                Resets in {formatTimeRemaining(status.resetTime)}
              </div>
            </div>

            {/* Request Quota */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Requests</span>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">
                    {status.requestsUsed.toLocaleString()} / {status.requestsLimit.toLocaleString()}
                  </span>
                  {!hasPremiumAccess && (
                    <span className="text-xs text-blue-600">
                      <Lock className="w-3 h-3 inline" /> Limited
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    getUsageColor(status.requestsUsed, status.requestsLimit)
                  }`}
                  style={{ width: `${Math.min((status.requestsUsed / status.requestsLimit) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {((status.requestsUsed / status.requestsLimit) * 100).toFixed(1)}% used
              </div>
            </div>

            {/* Data Quota */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Data Transfer</span>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">
                    {formatBytes(status.dataUsed)} / {formatBytes(status.dataLimit)}
                  </span>
                  {!hasPremiumAccess && (
                    <span className="text-xs text-blue-600">
                      <Lock className="w-3 h-3 inline" /> Limited
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    getUsageColor(status.dataUsed, status.dataLimit)
                  }`}
                  style={{ width: `${Math.min((status.dataUsed / status.dataLimit) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {((status.dataUsed / status.dataLimit) * 100).toFixed(1)}% used
              </div>
            </div>

            {/* Rate Limit Specifications */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <h5 className="text-sm font-medium text-gray-900 mb-2">API Limits</h5>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {status.site === 'chess.com' ? (
                  <>
                    <div>
                      <span className="text-gray-600">Rate:</span>
                      <p className="font-medium">1 req/sec {hasPremiumAccess && "(Premium)"}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Type:</span>
                      <p className="font-medium">Soft limit</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-gray-600">Rate:</span>
                      <p className="font-medium">{hasPremiumAccess ? "20" : "5"} req/sec {hasPremiumAccess && "(Premium)"}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Data:</span>
                      <p className="font-medium">{hasPremiumAccess ? "15" : "3"} MB/min {hasPremiumAccess && "(Premium)"}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Recommendations */}
            {status.recommendations.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-medium text-yellow-900">Recommendations</h5>
                    <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                      {status.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start space-x-1">
                          <span>•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Implementation Details */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start space-x-2">
          <Database className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Rate Limiting Implementation</h4>
            <p className="text-sm text-blue-700 mt-1">
              <strong>Chess.com:</strong> pThrottle 1 req/s with burst protection<br />
              <strong>Lichess:</strong> {hasPremiumAccess ? "15" : "5"} req/s, {hasPremiumAccess ? "5MB" : "1MB"} body limit, single fetch ≤{hasPremiumAccess ? "300" : "100"} games
            </p>
            {!hasPremiumAccess && (
              <div className="mt-2 flex items-center space-x-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-medium text-blue-700">
                  Premium users get higher rate limits and priority access
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RateLimitMonitor;