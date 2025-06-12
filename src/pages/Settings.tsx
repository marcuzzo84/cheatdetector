import React, { useState } from 'react';
import { Save, Upload, Key, Shield, Database, Activity, AlertCircle, CheckCircle } from 'lucide-react';

const Settings: React.FC = () => {
  const [apiKey, setApiKey] = useState('sk-fp-••••••••••••••••••••••••••••••••');
  const [supabaseUrl, setSupabaseUrl] = useState('https://••••••••••••••••••••.supabase.co');
  const [modelVersion, setModelVersion] = useState('v2.1.3');
  const [rateLimit, setRateLimit] = useState(10);
  const [mlThreshold, setMlThreshold] = useState(0.75);

  const handleSave = () => {
    // Simulate save action
    alert('Settings saved successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Configure system parameters and security settings</p>
      </div>

      {/* API Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Key className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">API Configuration</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="jwt-secret" className="block text-sm font-medium text-gray-700 mb-2">
              JWT Secret Key
            </label>
            <div className="relative">
              <input
                type="password"
                id="jwt-secret"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter JWT secret key"
              />
              <Shield className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
          </div>

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
        </div>
      </div>

      {/* ML Model Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">ML Model Configuration</h3>
        </div>

        <div className="space-y-4">
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

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Model Performance</h4>
                <p className="text-sm text-blue-700">Current AUC: 0.89 | Validation Accuracy: 94.2%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Database Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Database className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Database Status</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-900">Connection Healthy</span>
            </div>
            <p className="text-sm text-green-700 mt-1">Last check: 2 mins ago</p>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-blue-900">Storage Usage</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">2.4 GB / 10 GB used</p>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-medium text-purple-900">Active Connections</span>
            </div>
            <p className="text-sm text-purple-700 mt-1">12 / 100 connections</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Save className="w-5 h-5" />
          <span>Save Configuration</span>
        </button>
      </div>
    </div>
  );
};

export default Settings;