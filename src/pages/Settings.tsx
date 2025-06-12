import React, { useState } from 'react';
import { Save, Upload, Key, Shield, Database, Activity, AlertCircle, CheckCircle, User, Eye, EyeOff, Copy, Plus, Trash2, Edit3, RefreshCw } from 'lucide-react';

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
  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Security Admin',
    email: 'admin@fairplay-scout.com',
    role: 'Administrator',
    avatar: '',
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Manage your profile, API keys, and system configuration</p>
      </div>

      {/* Profile Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Profile Settings</h3>
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
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">{profile.name}</h4>
                <p className="text-sm text-gray-500">{profile.role}</p>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
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
            <h3 className="text-lg font-semibold text-gray-900">API Keys</h3>
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
    </div>
  );
};

export default Settings;