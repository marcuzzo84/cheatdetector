import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings as SettingsIcon, Shield, Users, Database, Globe, Moon, Sun, Save, RefreshCw, Rocket, Server, Key, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import DeploymentButton from '../components/DeploymentButton';

const Settings: React.FC = () => {
  const { userProfile, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setError] = useState<string | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  
  // Settings state
  const [settings, setSettings] = useState({
    general: {
      siteName: 'FairPlay-Scout Dashboard',
      siteDescription: 'Chess anti-cheat monitoring dashboard with real-time analysis',
      enableDarkMode: isDark,
      defaultLanguage: 'en',
      timeZone: 'UTC'
    },
    security: {
      enableTwoFactor: false,
      sessionTimeout: 60,
      maxLoginAttempts: 5,
      passwordExpiration: 90
    },
    api: {
      chessComRateLimit: 1,
      lichessRateLimit: 20,
      enableRateLimiting: true,
      apiTimeout: 30
    },
    database: {
      maxConnections: 20,
      statementTimeout: 30000,
      enablePooling: true,
      enableRealtime: true
    }
  });

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Apply theme change if it was modified
      if (settings.general.enableDarkMode !== isDark) {
        toggleTheme();
      }
      
      setSaveSuccess(true);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeploySuccess = (url: string) => {
    setDeployUrl(url);
  };

  if (!isAdmin) {
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
            <Link
              to="/dashboard"
              className="inline-block w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link to="/dashboard" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure application settings and preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Settings</h3>
            </div>
            <nav className="space-y-1 p-2">
              <button
                onClick={() => setActiveTab('general')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                  activeTab === 'general'
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <SettingsIcon className="w-5 h-5" />
                <span>General</span>
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                  activeTab === 'security'
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Shield className="w-5 h-5" />
                <span>Security</span>
              </button>
              <button
                onClick={() => setActiveTab('api')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                  activeTab === 'api'
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Globe className="w-5 h-5" />
                <span>API Settings</span>
              </button>
              <button
                onClick={() => setActiveTab('database')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                  activeTab === 'database'
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Database className="w-5 h-5" />
                <span>Database</span>
              </button>
              <button
                onClick={() => setActiveTab('deployment')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                  activeTab === 'deployment'
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Rocket className="w-5 h-5" />
                <span>Deployment</span>
              </button>
            </nav>
          </div>
          
          {/* Admin Info */}
          <div className="mt-4 bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-4 h-4 text-purple-600" />
              <h3 className="font-medium text-purple-900">Admin Access</h3>
            </div>
            <p className="text-sm text-purple-700 mb-2">
              You have administrator privileges. These settings affect the entire application.
            </p>
            <div className="text-xs text-purple-600">
              <p>User: {userProfile?.full_name || 'Admin'}</p>
              <p>Role: {userProfile?.role || 'Administrator'}</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Status Messages */}
          {saveSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-sm text-green-700">Settings saved successfully</span>
              </div>
            </div>
          )}

          {saveError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
                <span className="text-sm text-red-700">{saveError}</span>
              </div>
            </div>
          )}

          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">General Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site Name
                  </label>
                  <input
                    type="text"
                    value={settings.general.siteName}
                    onChange={(e) => setSettings({
                      ...settings,
                      general: { ...settings.general, siteName: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site Description
                  </label>
                  <textarea
                    value={settings.general.siteDescription}
                    onChange={(e) => setSettings({
                      ...settings,
                      general: { ...settings.general, siteDescription: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="darkMode"
                    checked={settings.general.enableDarkMode}
                    onChange={(e) => setSettings({
                      ...settings,
                      general: { ...settings.general, enableDarkMode: e.target.checked }
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="darkMode" className="ml-2 block text-sm text-gray-700 flex items-center">
                    Enable Dark Mode
                    {settings.general.enableDarkMode ? (
                      <Moon className="w-4 h-4 ml-2 text-gray-600" />
                    ) : (
                      <Sun className="w-4 h-4 ml-2 text-gray-600" />
                    )}
                  </label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Language
                    </label>
                    <select
                      value={settings.general.defaultLanguage}
                      onChange={(e) => setSettings({
                        ...settings,
                        general: { ...settings.general, defaultLanguage: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="ru">Russian</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time Zone
                    </label>
                    <select
                      value={settings.general.timeZone}
                      onChange={(e) => setSettings({
                        ...settings,
                        general: { ...settings.general, timeZone: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Europe/Paris">Central European Time (CET)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Security Settings</h2>
              
              <div className="space-y-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="twoFactor"
                    checked={settings.security.enableTwoFactor}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, enableTwoFactor: e.target.checked }
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="twoFactor" className="ml-2 block text-sm text-gray-700">
                    Enable Two-Factor Authentication
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.security.sessionTimeout}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, sessionTimeout: parseInt(e.target.value) }
                    })}
                    min="5"
                    max="1440"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Users will be automatically logged out after this period of inactivity
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Login Attempts
                  </label>
                  <input
                    type="number"
                    value={settings.security.maxLoginAttempts}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, maxLoginAttempts: parseInt(e.target.value) }
                    })}
                    min="3"
                    max="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Account will be temporarily locked after this many failed attempts
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password Expiration (days)
                  </label>
                  <input
                    type="number"
                    value={settings.security.passwordExpiration}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, passwordExpiration: parseInt(e.target.value) }
                    })}
                    min="0"
                    max="365"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Users will be prompted to change their password after this many days (0 to disable)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* API Settings */}
          {activeTab === 'api' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">API Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chess.com Rate Limit (requests/second)
                  </label>
                  <input
                    type="number"
                    value={settings.api.chessComRateLimit}
                    onChange={(e) => setSettings({
                      ...settings,
                      api: { ...settings.api, chessComRateLimit: parseInt(e.target.value) }
                    })}
                    min="1"
                    max="5"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Chess.com has a soft limit of 1 request per second
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lichess Rate Limit (requests/second)
                  </label>
                  <input
                    type="number"
                    value={settings.api.lichessRateLimit}
                    onChange={(e) => setSettings({
                      ...settings,
                      api: { ...settings.api, lichessRateLimit: parseInt(e.target.value) }
                    })}
                    min="1"
                    max="30"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Lichess allows up to 20 requests per second for most endpoints
                  </p>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableRateLimiting"
                    checked={settings.api.enableRateLimiting}
                    onChange={(e) => setSettings({
                      ...settings,
                      api: { ...settings.api, enableRateLimiting: e.target.checked }
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="enableRateLimiting" className="ml-2 block text-sm text-gray-700">
                    Enable API Rate Limiting
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    value={settings.api.apiTimeout}
                    onChange={(e) => setSettings({
                      ...settings,
                      api: { ...settings.api, apiTimeout: parseInt(e.target.value) }
                    })}
                    min="5"
                    max="120"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum time to wait for API responses before timing out
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Database Settings */}
          {activeTab === 'database' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Database Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Connections
                  </label>
                  <input
                    type="number"
                    value={settings.database.maxConnections}
                    onChange={(e) => setSettings({
                      ...settings,
                      database: { ...settings.database, maxConnections: parseInt(e.target.value) }
                    })}
                    min="5"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum number of concurrent database connections
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Statement Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={settings.database.statementTimeout}
                    onChange={(e) => setSettings({
                      ...settings,
                      database: { ...settings.database, statementTimeout: parseInt(e.target.value) }
                    })}
                    min="1000"
                    max="120000"
                    step="1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum time a query can run before being cancelled
                  </p>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enablePooling"
                    checked={settings.database.enablePooling}
                    onChange={(e) => setSettings({
                      ...settings,
                      database: { ...settings.database, enablePooling: e.target.checked }
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="enablePooling" className="ml-2 block text-sm text-gray-700">
                    Enable Connection Pooling
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableRealtime"
                    checked={settings.database.enableRealtime}
                    onChange={(e) => setSettings({
                      ...settings,
                      database: { ...settings.database, enableRealtime: e.target.checked }
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="enableRealtime" className="ml-2 block text-sm text-gray-700">
                    Enable Realtime Subscriptions
                  </label>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Database className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Database Information</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Connected to Supabase PostgreSQL database
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-blue-800">
                        <div>
                          <span className="font-medium">Provider:</span> Supabase
                        </div>
                        <div>
                          <span className="font-medium">Version:</span> PostgreSQL 15.3
                        </div>
                        <div>
                          <span className="font-medium">Status:</span> Connected
                        </div>
                        <div>
                          <span className="font-medium">Tables:</span> 12
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deployment Settings */}
          {activeTab === 'deployment' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Deployment</h2>
              
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <Rocket className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Netlify Deployment</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Deploy your FairPlay-Scout Dashboard to Netlify with one click. This will build and deploy the latest version of your application.
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-blue-800">
                        <div>
                          <span className="font-medium">Build Command:</span> npm run build
                        </div>
                        <div>
                          <span className="font-medium">Publish Directory:</span> dist
                        </div>
                        <div>
                          <span className="font-medium">Node Version:</span> 18.x
                        </div>
                        <div>
                          <span className="font-medium">Framework:</span> Vite
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <DeploymentButton onSuccess={handleDeploySuccess} />
                
                {deployUrl && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-green-800">Deployment History</h4>
                        <p className="text-sm text-green-700 mt-1">
                          Latest deployment: {new Date().toLocaleString()}
                        </p>
                        <a
                          href={deployUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>{deployUrl}</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Environment Variables</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Key className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">VITE_SUPABASE_URL</span>
                      </div>
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">Set</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Key className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">VITE_SUPABASE_ANON_KEY</span>
                      </div>
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">Set</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button (except for deployment tab) */}
          {activeTab !== 'deployment' && (
            <div className="flex justify-end mt-6">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;