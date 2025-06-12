import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Activity, Calendar } from 'lucide-react';
import { mockPlayerData } from '../data/mockData';
import AccuracyHeatmap from '../components/AccuracyHeatmap';
import GameHistoryAccordion from '../components/GameHistoryAccordion';

const PlayerDetail: React.FC = () => {
  const { hash } = useParams<{ hash: string }>();
  const player = mockPlayerData.find(p => p.hash === hash) || mockPlayerData[0];

  const getSuspicionColor = (level: number) => {
    if (level >= 70) return 'text-red-600 bg-red-50';
    if (level >= 40) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getSuspicionIcon = (level: number) => {
    if (level >= 70) return TrendingUp;
    if (level >= 40) return Activity;
    return TrendingDown;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          to="/dashboard"
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Player Analysis</h1>
          <p className="text-gray-600">Detailed performance and suspicion metrics</p>
        </div>
      </div>

      {/* Player Info Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Player Hash</h2>
              <p className="text-lg text-gray-600 font-mono bg-gray-50 px-3 py-1 rounded">{player.hash}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <span className="text-sm text-gray-500">Current Elo</span>
                <p className="text-2xl font-bold text-gray-900">{player.elo}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Games Analyzed</span>
                <p className="text-2xl font-bold text-gray-900">{player.gamesCount}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Avg Suspicion</span>
                <div className="flex items-center space-x-2">
                  <span className={`text-2xl font-bold ${getSuspicionColor(player.avgSuspicion).split(' ')[0]}`}>
                    {player.avgSuspicion}%
                  </span>
                  {React.createElement(getSuspicionIcon(player.avgSuspicion), {
                    className: `w-5 h-5 ${getSuspicionColor(player.avgSuspicion).split(' ')[0]}`
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <ExternalLink className="w-4 h-4" />
              <span>View on Chess.com</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
              <ExternalLink className="w-4 h-4" />
              <span>View on Lichess</span>
            </button>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Average Engine Match</span>
              <span className="font-medium">{player.avgEngineMatch}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${player.avgEngineMatch}%` }}></div>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">ML Probability</span>
              <span className="font-medium">{(player.mlProb * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${player.mlProb * 100}%` }}></div>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Perfect Run Streak</span>
              <span className="font-medium">{player.perfectRunStreak} moves</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Last analyzed: {player.lastSeen}</span>
            </div>
            <div className="flex items-center space-x-3">
              <Activity className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Active on both platforms</span>
            </div>
            <div className="pt-2">
              <span className="text-sm text-gray-500">Sites:</span>
              <div className="flex space-x-2 mt-1">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Chess.com</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Lichess</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accuracy Heatmap */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Accuracy vs Move Number</h3>
        <AccuracyHeatmap data={player.accuracyHeatmap} />
      </div>

      {/* Game History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Games</h3>
        <GameHistoryAccordion games={player.recentGames} />
      </div>
    </div>
  );
};

export default PlayerDetail;