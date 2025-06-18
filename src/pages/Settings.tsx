import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Upload, Key, Shield, Database, Activity, AlertCircle, CheckCircle, User, Eye, EyeOff, Copy, Plus, Trash2, Edit3, RefreshCw, Calendar, Clock, ArrowLeft, Crown, Star, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  created: string;
  lastUsed: string;
  isActive: boolean;
}

interface UserProfile {
  name: string;
  email: string;
  role: string;
  avatar: string;
  twoFactorEnabled: boolean;
  lastLogin: string;
}

const Settings: React.FC = () => {
  const { user, userProfile, isAdmin } = useAuth();

  // Redirect non-admin users (this should be handled by AdminRoute, but extra safety)
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link to="/dashboard" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">Administrator privileges required</p>
          </div>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">You don't have permission to access admin settings.</span>
          </div>
        </div>
      </div>
    );
  }

  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    name: userProfile?.full_name || 'Security Admin',
    email: user?.email || 'admin@fairplay-scout.com',
    role: userProfile?.role || 'Administrator',
    avatar: userProfile?.avatar_url || '',
    twoFactorEnabled: true,
    lastLogin: '2024-01-15 14:30:00'
  });

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Production Dashboard',
      key: 'fp_live_••••••••••••••••••••••••••••••••',
      permissions: ['read:scores', 'read:players', 'read:games'],
      created: '2024-01-10',
      lastUsed: '2 hours ago',
      isActive: true
    },
    {
      id: '2',
      name: 'Analytics Service',
      key: 'fp_live_••••••••••••••••••••••••••••••••',
      permissions: ['read:scores', 'write:analytics'],
      created: '2024-01-05',
      lastUsed: '1 day ago',
      isActive: true
    },
    {
      id: '3',
      name: 'Development Testing',
      key: 'fp_test_••••••••••••••••••••••••••••••••',
      permissions: ['read:all'],
      created: '2024-01-01',
      lastUsed: 'Never',
      isActive: false
    }
  ]);

  // Form states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showNewApiKeyModal, setShowNewApiKeyModal] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [newApiKeyPermissions, setNewApiKeyPermissions] = useState<string[]>([]);
  const [generatedApiKey, setGeneratedApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({});
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // System configuration
  const [supabaseUrl, setSupabaseUrl] = useState('https://••••••••••••••••••••.supabase.co');
  const [modelVersion, setModelVersion] = useState('v2.1.3');
  const [rateLimit, setRateLimit] = useState(10);
  const [mlThreshold, setMlThreshold] = useState(0.75);

  const availablePermissions = [
    'read:scores',
    'write:scores',
    'read:players',
    'write:players',
    'read:games',
    'write:games',
    'read:analytics',
    'write:analytics',
    'admin:all'
  ];

  const handleSaveProfile = () => {
    // Simulate save action
    setIsEditingProfile(false);
    alert('Profile updated successfully!');
  };

  const handleSaveSettings = () => {
    // Simulate save action
    alert('Settings saved successfully!');
  };

  const handleGenerateApiKey = () => {
    if (!newApiKeyName.trim() || newApiKeyPermissions.length === 0) {
      alert('Please provide a name and select at least one permission.');
      return;
    }

    const newKey = `fp_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const newApiKey: ApiKey = {
      id: Date.now().toString(),
      name: newApiKeyName,
      key: newKey,
      permissions: newApiKeyPermissions,
      created: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
      isActive: true
    };

    setApiKeys([...apiKeys, newApiKey]);
    setGeneratedApiKey(newKey);
    setNewApiKeyName('');
    setNewApiKeyPermissions([]);
  };

  const handleDeleteApiKey = (id: string) => {
    if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      setApiKeys(apiKeys.filter(key => key.id !== id));
    }
  };

  const handleToggleApiKey = (id: string) => {
    setApiKeys(apiKeys.map(key => 
      key.id === id ? { ...key, isActive: !key.isActive } : key
    ));
  };

  const toggleShowApiKey = (id: string) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }
    // Simulate password change
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    alert('Password changed successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Header with Admin Badge */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
              <Shield className="w-4 h-4 mr-1" />
              Administrator
            </span>
          </div>
          <p className="mt-2 text-gray-600">Manage system configuration, API keys, and administrative settings</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="bg-purple-50 px-3 py-2 rounded-lg">
            <p className="text-sm text-purple-700">
              <strong>Role:</strong> {profile.role}
            </p>
          </div>
        </div>
      </div>

      {/* Admin Warning */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-purple-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-purple-900">Administrator Access</h4>
            <p className="text-sm text-purple-700 mt-1">
              You have full administrative privileges. Changes made here affect the entire system and all users. 
              Please exercise caution when modifying system settings.
            </p>
          </div>
        </div>
      </div>

      {/* Subscription Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Star className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Subscription Management</h3>
          </div>
          <button
            onClick={() => setShowSubscriptionModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Crown className="w-4 h-4" />
            <span>Manage Subscriptions</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <User className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Free Plan</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">Basic access with limited features</p>
            <div className="text-xs text-gray-600">
              <p>• PGN file uploads</p>
              <p>• Basic analysis</p>
              <p>• 100 games/month</p>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Star className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-900">Premium Plan</span>
            </div>
            <p className="text-sm text-yellow-700 mb-2">Enhanced features for serious users</p>
            <div className="text-xs text-yellow-600">
              <p>• Live API imports</p>
              <p>• Advanced analytics</p>
              <p>• 1,000 games/month</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">Pro Plan</span>
            </div>
            <p className="text-sm text-blue-700 mb-2">Full access for professionals</p>
            <div className="text-xs text-blue-600">
              <p>• Unlimited games</p>
              <p>• Custom analysis models</p>
              <p>• API access & white-label</p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <Star className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Subscription Features</h4>
              <p className="text-sm text-blue-700 mt-1">
                Manage user subscription tiers and feature access. Premium and Pro users have access to live API imports, 
                advanced analytics, and higher usage limits. Free users can still upload PGN files for basic analysis.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scheduler Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Scheduler Management</h3>
          </div>
          <Link
            to="/scheduler"
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            <Clock className="w-4 h-4" />
            <span>View Scheduler Dashboard</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-900">Nightly Sync</span>
            </div>
            <p className="text-sm text-purple-700 mb-2">Daily import of tracked players</p>
            <div className="text-xs text-purple-600">
              <p>Schedule: 04:15 UTC daily</p>
              <p>Status: Active</p>
              <p>Last run: Today at 04:15</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">Weekly Deep Sync</span>
            </div>
            <p className="text-sm text-blue-700 mb-2">Comprehensive sync for top players</p>
            <div className="text-xs text-blue-600">
              <p>Schedule: Sunday 02:00 UTC</p>
              <p>Status: Active</p>
              <p>Last run: Last Sunday</p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Priority Sync</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">Hourly sync for suspicious players</p>
            <div className="text-xs text-gray-600">
              <p>Schedule: Every hour</p>
              <p>Status: Disabled</p>
              <p>Last run: Never</p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-purple-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <Calendar className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-purple-900">Automated Scheduling</h4>
              <p className="text-sm text-purple-700 mt-1">
                The scheduler automatically imports games from tracked players based on the bolt.schedule.yaml configuration. 
                Visit the Scheduler Dashboard to monitor job executions and trigger manual imports.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Admin Profile Settings</h3>
          </div>
          <button
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            className="flex items-center space-x-2 px-3 py-1 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>{isEditingProfile ? 'Cancel' : 'Edit'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">{profile.name}</h4>
                <p className="text-sm text-purple-600 font-medium">{profile.role}</p>
                <p className="text-xs text-gray-400">Last login: {profile.lastLogin}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  disabled={!isEditingProfile}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  disabled={!isEditingProfile}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <input
                  type="text"
                  value={profile.role}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-purple-50 text-purple-700 font-medium"
                />
              </div>
            </div>

            {isEditingProfile && (
              <button
                onClick={handleSaveProfile}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save Profile</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Security Settings</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Two-Factor Authentication</span>
                </div>
                <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">Enabled</span>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Change Password</label>
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleChangePassword}
                  disabled={!currentPassword || !newPassword || !confirmPassword}
                  className="w-full px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Keys Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">API Keys Management</h3>
          </div>
          <button
            onClick={() => setShowNewApiKeyModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Generate New Key</span>
          </button>
        </div>

        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h4 className="font-medium text-gray-900">{apiKey.name}</h4>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    apiKey.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {apiKey.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleApiKey(apiKey.id)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      apiKey.isActive 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {apiKey.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDeleteApiKey(apiKey.id)}
                    className="p-1 text-red-600 hover:text-red-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-2 py-1 bg-gray-50 rounded text-sm font-mono">
                      {showApiKey[apiKey.id] ? apiKey.key.replace('••••••••••••••••••••••••••••••••', 'abcdef1234567890abcdef1234567890') : apiKey.key}
                    </code>
                    <button
                      onClick={() => toggleShowApiKey(apiKey.id)}
                      className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showApiKey[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(showApiKey[apiKey.id] ? apiKey.key.replace('••••••••••••••••••••••••••••••••', 'abcdef1234567890abcdef1234567890') : apiKey.key)}
                      className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Permissions</label>
                  <div className="flex flex-wrap gap-1">
                    {apiKey.permissions.map((permission) => (
                      <span key={permission} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>Created: {apiKey.created}</span>
                <span>Last used: {apiKey.lastUsed}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Database className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">System Configuration</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="supabase-url" className="block text-sm font-medium text-gray-700 mb-2">
              Supabase URL
            </label>
            <input
              type="url"
              id="supabase-url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://your-project.supabase.co"
            />
          </div>

          <div>
            <label htmlFor="rate-limit" className="block text-sm font-medium text-gray-700 mb-2">
              Rate Limit (requests/min/IP)
            </label>
            <input
              type="number"
              id="rate-limit"
              value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              max="100"
            />
          </div>

          <div>
            <label htmlFor="model-version" className="block text-sm font-medium text-gray-700 mb-2">
              Current Model Version
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                id="model-version"
                value={modelVersion}
                onChange={(e) => setModelVersion(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                readOnly
              />
              <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                <Upload className="w-4 h-4" />
                <span>Upload New Model</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="ml-threshold" className="block text-sm font-medium text-gray-700 mb-2">
              ML Suspicion Threshold
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                id="ml-threshold"
                min="0.1"
                max="1.0"
                step="0.05"
                value={mlThreshold}
                onChange={(e) => setMlThreshold(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-medium text-gray-700 min-w-12">{mlThreshold}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Database Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-900">Database Healthy</span>
            </div>
            <p className="text-sm text-green-700 mt-1">Last check: 2 mins ago</p>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-blue-900">Storage Usage</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">2.4 GB / 10 GB used</p>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-medium text-purple-900">API Requests</span>
            </div>
            <p className="text-sm text-purple-700 mt-1">1,247 requests today</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Save className="w-5 h-5" />
          <span>Save Configuration</span>
        </button>
      </div>

      {/* New API Key Modal */}
      {showNewApiKeyModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Generate New API Key</h3>
                <button
                  onClick={() => {
                    setShowNewApiKeyModal(false);
                    setGeneratedApiKey('');
                    setNewApiKeyName('');
                    setNewApiKeyPermissions([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              {!generatedApiKey ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key Name
                    </label>
                    <input
                      type="text"
                      value={newApiKeyName}
                      onChange={(e) => setNewApiKeyName(e.target.value)}
                      placeholder="e.g., Production Dashboard, Analytics Service"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Permissions
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {availablePermissions.map((permission) => (
                        <label key={permission} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={newApiKeyPermissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewApiKeyPermissions([...newApiKeyPermissions, permission]);
                              } else {
                                setNewApiKeyPermissions(newApiKeyPermissions.filter(p => p !== permission));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{permission}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => setShowNewApiKeyModal(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateApiKey}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      Generate API Key
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-green-900">API Key Generated Successfully!</span>
                    </div>
                    <p className="text-sm text-green-700">
                      Please copy this API key now. You won't be able to see it again for security reasons.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your New API Key
                    </label>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 px-3 py-2 bg-gray-50 rounded text-sm font-mono border">
                        {generatedApiKey}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generatedApiKey)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => {
                        setShowNewApiKeyModal(false);
                        setGeneratedApiKey('');
                        setNewApiKeyName('');
                        setNewApiKeyPermissions([]);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subscription Management Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Subscription Management</h3>
                    <p className="text-sm text-gray-600">Manage user subscription tiers and feature access</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSubscriptionModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Subscription Plans */}
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
                        <button className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">
                          Default Plan
                        </button>
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
                          Assign to Users
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
                          Assign to Users
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Subscription Management */}
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">User Subscription Management</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Plan</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-white">JD</span>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">John Doe</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">john@example.com</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Star className="w-3 h-3 mr-1" />
                              Premium
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                            <button className="text-red-600 hover:text-red-900">Revoke</button>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-white">JS</span>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">Jane Smith</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">jane@example.com</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <Zap className="w-3 h-3 mr-1" />
                              Pro
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                            <button className="text-red-600 hover:text-red-900">Revoke</button>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-white">RJ</span>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">Robert Johnson</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">robert@example.com</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Free
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-blue-600 hover:text-blue-900 mr-3">Upgrade</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowSubscriptionModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;