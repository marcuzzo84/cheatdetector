import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Shield, Wifi, WifiOff, X, ArrowLeft, AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, cancelAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'timeout'>('connecting');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    let statusTimeout: NodeJS.Timeout;
    let maxTimeout: NodeJS.Timeout;

    if (loading) {
      setShowProgress(true);
      setConnectionStatus('connecting');
      setProgress(0);
      setTimeoutReached(false);
      
      // Simulate authentication progress
      progressInterval = setInterval(() => {
        setProgress(prev => {
          // Cap at 90% until actual auth completes
          if (prev >= 90) {
            return 90;
          }
          // Increment by random amount but ensure we don't exceed 90
          const increment = Math.random() * 10;
          return Math.min(prev + increment, 90);
        });
      }, 200);

      // Simulate connection status updates
      statusTimeout = setTimeout(() => {
        setConnectionStatus('connected');
      }, 1000);

      // Maximum timeout - if loading takes too long, show timeout state
      maxTimeout = setTimeout(() => {
        setTimeoutReached(true);
        setConnectionStatus('timeout');
        setProgress(100);
      }, 8000); // 8 second max timeout

      return () => {
        clearInterval(progressInterval);
        clearTimeout(statusTimeout);
        clearTimeout(maxTimeout);
      };
    } else {
      // Complete the progress bar when loading finishes
      if (showProgress) {
        setProgress(100);
        setConnectionStatus(user ? 'connected' : 'disconnected');
        
        // Hide progress bar after completion animation
        const hideTimeout = setTimeout(() => {
          setShowProgress(false);
          setProgress(0);
        }, 800);
        
        return () => clearTimeout(hideTimeout);
      }
    }
  }, [loading, user, showProgress]);

  const handleCancelConnection = () => {
    console.log('🚫 User cancelled connection');
    cancelAuth();
    navigate('/signin', { replace: true });
  };

  const handleStopConnection = () => {
    setShowCancelConfirm(true);
  };

  const handleTimeoutRetry = () => {
    setTimeoutReached(false);
    setConnectionStatus('connecting');
    setProgress(0);
    // Force a page reload to restart the auth process
    window.location.reload();
  };

  if (loading || showProgress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center max-w-md w-full px-6">
          {/* Cancel Button */}
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={handleStopConnection}
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-white/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Login</span>
            </button>
            
            <button
              onClick={handleStopConnection}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
              title="Cancel connection"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Loading Animation */}
          <div className="mb-6">
            {timeoutReached ? (
              <AlertTriangle className="w-8 h-8 mx-auto text-orange-600 mb-4" />
            ) : (
              <Loader2 className="w-8 h-8 mx-auto text-blue-600 animate-spin mb-4" />
            )}
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {timeoutReached ? 'Connection Timeout' : 'Loading FairPlay-Scout'}
            </h2>
            <p className="text-gray-600 mb-4">
              {timeoutReached 
                ? 'Authentication is taking longer than expected...' 
                : 'Verifying your authentication...'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ease-out ${
                  timeoutReached ? 'bg-orange-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'
                }`}
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>{timeoutReached ? 'Timeout reached' : 'Authenticating...'}</span>
              <span>{Math.min(Math.max(Math.round(progress), 0), 100)}%</span>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-center space-x-2 mb-6">
            {connectionStatus === 'connecting' && (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-yellow-600 font-medium">Connecting to server...</span>
              </>
            )}
            {connectionStatus === 'connected' && (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">Connected securely</span>
              </>
            )}
            {connectionStatus === 'disconnected' && (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600 font-medium">Connection failed</span>
              </>
            )}
            {connectionStatus === 'timeout' && (
              <>
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-orange-600 font-medium">Connection timeout</span>
              </>
            )}
          </div>

          {/* Status Steps */}
          <div className="space-y-2 text-left mb-6">
            <div className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
              progress > 20 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                progress > 20 ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm">Establishing secure connection</span>
            </div>
            
            <div className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
              progress > 50 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                progress > 50 ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm">Verifying authentication token</span>
            </div>
            
            <div className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
              progress > 80 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                progress > 80 ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm">Loading user permissions</span>
            </div>
            
            <div className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
              progress >= 100 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                progress >= 100 ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm">Initializing dashboard</span>
            </div>
          </div>

          {/* Timeout Actions */}
          {timeoutReached ? (
            <div className="space-y-3">
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-700">
                  The authentication process is taking longer than expected. This might be due to network issues or server load.
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleTimeoutRetry}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Retry Connection
                </button>
                <button
                  onClick={handleCancelConnection}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium"
                >
                  Go to Login
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Timeout Warning */}
              {progress > 0 && progress < 100 && (
                <div className="p-3 bg-blue-50 rounded-lg mb-6">
                  <p className="text-xs text-blue-600">
                    This may take a moment on first load while we verify your credentials and establish a secure connection.
                  </p>
                </div>
              )}

              {/* Cancel Connection Button */}
              <div>
                <button
                  onClick={handleStopConnection}
                  className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                >
                  Cancel Connection
                </button>
              </div>
            </>
          )}
        </div>

        {/* Cancel Confirmation Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <X className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
                
                <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                  Cancel Connection?
                </h3>
                
                <p className="text-sm text-gray-600 text-center mb-6">
                  This will stop the authentication process and return you to the login page. 
                  You'll need to sign in again to access the dashboard.
                </p>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Continue Loading
                  </button>
                  <button
                    onClick={() => {
                      setShowCancelConfirm(false);
                      handleCancelConnection();
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Cancel & Go Back
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    // Redirect to sign in page with return url
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;