import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, AlertTriangle, Activity, Eye, Clock } from 'lucide-react';
import KPICard from '../components/KPICard';
import SuspicionChart from '../components/SuspicionChart';
import RecentGamesTable from '../components/RecentGamesTable';
import RealtimeScoreStream from '../components/RealtimeScoreStream';
import { mockDashboardData, type Game } from '../data/mockData';

const Dashboard: React.FC = () => {
  const [recentGames, setRecentGames] = useState<Game[]>(mockDashboardData.recentGames.slice(0, 10));
  const [liveStats, setLiveStats] = useState(mockDashboardData.kpis);

  // Generate sparkline data for KPI cards
  const generateSparklineData = () => {
    return Array.from({ length: 7 }, () => Math.random() * 100 + 50);
  };

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new games being analyzed
      setLiveStats(prev => ({
        ...prev,
        gamesAnalyzed24h: prev.gamesAnalyzed24h + Math.floor(Math.random() * 3),
        avgElo: prev.avgElo + (Math.random() - 0.5) * 2
      }));

      // Occasionally add a new game
      if (Math.random() < 0.3) {
        const newGame: Game = {
          id: `game-${Date.now()}`,
          playerHash: `hash${Math.floor(Math.random() * 1000)}`,
          site: Math.random() > 0.5 ? 'Chess.com' : 'Lichess',
          suspicionLevel: Math.floor(Math.random() * 100),
          elo: 1200 + Math.floor(Math.random() * 800),
          matchEnginePct: 60 + Math.random() * 35,
          deltaCp: Math.random() * 50,
          mlProb: Math.random(),
          timestamp: new Date(),
          result: Math.random() > 0.5 ? 'Win' : Math.random() > 0.5 ? 'Loss' : 'Draw'
        };

        setRecentGames(prev => [newGame, ...prev.slice(0, 9)]);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard
          title="Games 24h"
          value={liveStats.gamesAnalyzed24h.toLocaleString()}
          icon={Activity}
          trend={+2.3}
          color="blue"
          sparklineData={generateSparklineData()}
        />
        <KPICard
          title="Suspect %"
          value={`${liveStats.suspectPercentage}%`}
          icon={AlertTriangle}
          trend={-0.5}
          color="orange"
          sparklineData={generateSparklineData()}
        />
        <KPICard
          title="Avg Elo 24h"
          value={Math.round(liveStats.avgElo).toLocaleString()}
          icon={TrendingUp}
          trend={+1.2}
          color="green"
          sparklineData={generateSparklineData()}
        />
      </div>

      {/* Real-time Score Stream */}
      <RealtimeScoreStream />

      {/* Suspicion Rate Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">📈 Suspicion rate last 30 days</h3>
          <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
            <Eye className="w-4 h-4 mr-1" />
            View Details
          </button>
        </div>
        <SuspicionChart data={mockDashboardData.suspicionTrends} />
      </div>

      {/* Latest High-Risk Games Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">📊 Latest high-risk games</h3>
              <p className="text-sm text-gray-600">Games with suspicion level ≥ 70%</p>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Updated live</span>
            </div>
          </div>
        </div>
        <RecentGamesTable games={recentGames.filter(game => game.suspicionLevel >= 70)} />
      </div>
    </div>
  );
};

export default Dashboard;