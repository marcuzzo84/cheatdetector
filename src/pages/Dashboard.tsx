import React, { useState } from 'react';
import { Eye, Download, Database, Loader2 } from 'lucide-react';
import SuspicionChart from '../components/SuspicionChart';
import RealtimeScoreStream from '../components/RealtimeScoreStream';
import LiveKPICards from '../components/LiveKPICards';
import LiveSuspiciousScoresTable from '../components/LiveSuspiciousScoresTable';
import DataImportModal from '../components/DataImportModal';

const Dashboard: React.FC = () => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleImportSuccess = () => {
    setRefreshing(true);
    // Refresh the page or trigger data reload
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleRefreshData = () => {
    setRefreshing(true);
    // Force refresh all components
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Real-time chess game analysis and suspicion monitoring</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefreshData}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Import Game Data</span>
          </button>
          <div className="flex items-center space-x-2 bg-green-50 px-3 py-2 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-700 font-medium">Live Monitoring Active</span>
          </div>
        </div>
      </div>

      {/* Data Import Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Database className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Get Started with Real Data</h4>
            <p className="text-sm text-blue-700 mt-1">
              Import chess games from Chess.com and Lichess to populate your dashboard with real analysis data. 
              Use the "Import Game Data" button to fetch games from top players or upload your own PGN files.
            </p>
            <div className="mt-2 flex space-x-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200 transition-colors"
              >
                Import via API
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-md hover:bg-green-200 transition-colors"
              >
                Upload PGN Files
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live KPI Cards */}
      <LiveKPICards />

      {/* Real-time Score Stream */}
      <RealtimeScoreStream />

      {/* Suspicion Rate Chart - Now using live data */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">📈 Suspicion rate last 30 days</h3>
          <button 
            onClick={handleRefreshData}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          >
            <Eye className="w-4 h-4 mr-1" />
            View Details
          </button>
        </div>
        {/* No need to pass data prop - component will use live data automatically */}
        <SuspicionChart />
      </div>

      {/* Live High-Risk Games Table */}
      <LiveSuspiciousScoresTable />

      {/* Data Import Modal */}
      <DataImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
};

export default Dashboard;