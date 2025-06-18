import React from 'react';
import { TrendingUp, Users, AlertTriangle, Activity, Loader2, Database } from 'lucide-react';
import { useLiveKPIs } from '../hooks/useLiveQueries';
import KPICard from './KPICard';

const LiveKPICards: React.FC = () => {
  const { kpis, loading, error } = useLiveKPIs();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              <div className="w-16 h-4 bg-gray-200 rounded"></div>
            </div>
            <div className="mt-4">
              <div className="w-20 h-4 bg-gray-200 rounded mb-2"></div>
              <div className="w-24 h-8 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">Error loading KPIs: {error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-3 bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <Database className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <span className="text-gray-500">No KPI data available</span>
          <p className="text-sm text-gray-400 mt-1">Import some games to see statistics</p>
        </div>
      </div>
    );
  }

  // Generate sparkline data for demonstration
  const generateSparklineData = () => {
    return Array.from({ length: 7 }, () => Math.random() * 100 + 50);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="relative">
        <KPICard
          title="Games 24h"
          value={kpis.games_24h.toLocaleString()}
          icon={Activity}
          trend={+2.3}
          color="blue"
          sparklineData={generateSparklineData()}
        />
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live updates enabled"></div>
        </div>
      </div>
      
      <div className="relative">
        <KPICard
          title="Suspect %"
          value={`${kpis.suspect_pct}%`}
          icon={AlertTriangle}
          trend={-0.5}
          color="orange"
          sparklineData={generateSparklineData()}
        />
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live updates enabled"></div>
        </div>
      </div>
      
      <div className="relative">
        <KPICard
          title="Avg Elo 24h"
          value={Math.round(kpis.avg_elo).toLocaleString()}
          icon={TrendingUp}
          trend={+1.2}
          color="green"
          sparklineData={generateSparklineData()}
        />
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live updates enabled"></div>
        </div>
      </div>
    </div>
  );
};

export default LiveKPICards;