import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Shield, Wifi, WifiOff } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    if (loading) {
      setShowProgress(true);
      setConnectionStatus('connecting');
      
      // Simulate authentication progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            return prev; // Stop at 90% until actual auth completes
          }
          return prev + Math.random() * 15; // Random increments
        });
      }, 200);

      // Simulate connection status updates
      const statusTimeout = setTimeout(() => {
        setConnectionStatus('connected');
      }, 1000);

      return () => {
        clearInterval(progressInterval);
        clearTimeout(statusTimeout);
      };
    } else {
      // Complete the progress bar when loading finishes
      setProgress(100);
      setConnectionStatus(user ? 'connected' : 'disconnected');
      
      // Hide progress bar after a short delay
      const hideTimeout = setTimeout(() => {
        setShowProgress(false);
      }, 500);
      
      return () => clearTimeout(hideTimeout);
    }
  }, [loading, user]);

  if (loading || showProgress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center max-w-md w-full px-6">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Loading Animation */}
          <div className="mb-6">
            <Loader2 className="w-8 h-8 mx-auto text-blue-600 animate-spin mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Loading FairPlay-Scout</h2>
            <p className="text-gray-600 mb-4">Verifying your authentication...</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Authenticating...</span>
              <span>{Math.round(progress)}%</span>
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
          </div>

          {/* Status Steps */}
          <div className="space-y-2 text-left">
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

          {/* Timeout Warning */}
          {progress > 0 && progress < 100 && (
            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600">
                This may take a moment on first load while we verify your credentials and establish a secure connection.
              </p>
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

  return <>{children}</>;
};