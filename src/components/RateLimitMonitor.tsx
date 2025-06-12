import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Zap, Database, Wifi } from 'lucide-react';

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
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

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
          requestsLimit: 3600,
          dataUsed: 2.1 * 1024 * 1024, // 2.1 MB
          dataLimit: 10 * 1024 * 1024, // 10 MB
          resetTime: Date.now() + 3600000,
          healthy: true,
          recommendations: []
        },
        {
          site: 'lichess',
          requestsUsed: 234,
          requestsLimit: 54000,
          dataUsed: 3.8 * 1024 * 1024, // 3.8 MB
          dataLimit: 5 * 1024 * 1024, // 5 MB
          resetTime: Date.now() + 60000,
          healthy: true,
          recommendations: ['Approaching data quota limit']
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
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Wifi className="w-4 h-4" />
          <span>Last updated: {lastUpdate?.toLocaleTimeString()}</span>
        </div>
      </div>

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
                <span className="font-medium">
                  {status.requestsUsed.toLocaleString()} / {status.requestsLimit.toLocaleString()}
                </span>
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
                <span className="font-medium">
                  {formatBytes(status.dataUsed)} / {formatBytes(status.dataLimit)}
                </span>
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
                      <p className="font-medium">1 req/sec</p>
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
                      <p className="font-medium">20 req/sec</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Data:</span>
                      <p className="font-medium">15 MB/min</p>
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
              <strong>Lichess:</strong> 15 req/s (conservative), 5MB body limit, single fetch ≤300 games
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RateLimitMonitor;