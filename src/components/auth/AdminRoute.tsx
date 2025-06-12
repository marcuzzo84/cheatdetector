import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Shield, AlertTriangle, Wifi, WifiOff, Crown } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, userProfile, isAdmin, loading } = useAuth();
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    if (loading) {
      setShowProgress(true);
      setConnectionStatus('connecting');
      setProgress(0); // Reset progress when loading starts
      
      // Simulate admin verification progress (slightly slower)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          // Cap at 90% until actual auth completes
          if (prev >= 90) {
            return 90;
          }
          // Slower increments for admin verification
          const increment = Math.random() * 8;
          return Math.min(prev + increment, 90);
        });
      }, 250);

      // Simulate connection status updates
      const statusTimeout = setTimeout(() => {
        setConnectionStatus('connected');
      }, 1200);

      return () => {
        clearInterval(progressInterval);
        clearTimeout(statusTimeout);
      };
    } else {
      // Complete the progress bar when loading finishes
      if (showProgress) {
        setProgress(100);
        setConnectionStatus(user ? 'connected' : 'disconnected');
        
        // Hide progress bar after completion animation
        const hideTimeout = setTimeout(() => {
          setShowProgress(false);
          setProgress(0); // Reset for next time
        }, 800);
        
        return () => clearTimeout(hideTimeout);
      }
    }
  }, [loading, user, showProgress]);

  if (loading || showProgress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100">
        <div className="text-center max-w-md w-full px-6">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <Crown className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Loading Animation */}
          <div className="mb-6">
            <Loader2 className="w-8 h-8 mx-auto text-purple-600 animate-spin mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Verifying Admin Access</h2>
            <p className="text-gray-600 mb-4">Checking your administrator permissions...</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Verifying permissions...</span>
              <span>{Math.min(Math.max(Math.round(progress), 0), 100)}%</span>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-center space-x-2 mb-6">
            {connectionStatus === 'connecting' && (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-yellow-600 font-medium">Connecting securely...</span>
              </>
            )}
            {connectionStatus === 'connected' && (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">Secure admin connection</span>
              </>
            )}
            {connectionStatus === 'disconnected' && (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600 font-medium">Connection failed</span>
              </>
            )}
          </div>

          {/* Status Steps */}
          <div className="space-y-2 text-left">
            <div className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
              progress > 15 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                progress > 15 ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm">Establishing secure connection</span>
            </div>
            
            <div className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
              progress > 40 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                progress > 40 ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm">Verifying user authentication</span>
            </div>
            
            <div className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
              progress > 65 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                progress > 65 ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm">Checking administrator privileges</span>
            </div>
            
            <div className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
              progress > 85 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                progress > 85 ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm">Loading admin dashboard</span>
            </div>
            
            <div className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
              progress >= 100 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                progress >= 100 ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm">Initializing admin controls</span>
            </div>
          </div>

          {/* Security Notice */}
          {progress > 0 && progress < 100 && (
            <div className="mt-6 p-3 bg-purple-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <Shield className="w-4 h-4 text-purple-600 mt-0.5" />
                <p className="text-xs text-purple-600">
                  Admin verification requires additional security checks and may take longer than standard authentication.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to sign in page with return url
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    // Show access denied page for non-admin users
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. Administrator privileges are required.
          </p>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                <strong>Your Role:</strong> {userProfile?.role || 'User'}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Required Role:</strong> Administrator
              </p>
            </div>
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
            <Navigate to="/dashboard" replace />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;