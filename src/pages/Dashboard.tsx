import React from 'react';
import { Eye } from 'lucide-react';
import SuspicionChart from '../components/SuspicionChart';
import RealtimeScoreStream from '../components/RealtimeScoreStream';
import LiveKPICards from '../components/LiveKPICards';
import LiveSuspiciousScoresTable from '../components/LiveSuspiciousScoresTable';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Real-time chess game analysis and suspicion monitoring</p>
        </div>
        <div className="flex items-center space-x-2 bg-green-50 px-3 py-2 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-700 font-medium">Live Monitoring Active</span>
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
          <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
            <Eye className="w-4 h-4 mr-1" />
            View Details
          </button>
        </div>
        {/* No need to pass data prop - component will use live data automatically */}
        <SuspicionChart />
      </div>

      {/* Live High-Risk Games Table */}
      <LiveSuspiciousScoresTable />
    </div>
  );
};

export default Dashboard;