import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { mockPlayerData, type Player } from '../data/mockData';

// Generate additional mock players for the list
const generateMockPlayers = (count: number): Player[] => {
  const additionalPlayers = [];
  for (let i = 0; i < count; i++) {
    additionalPlayers.push({
      hash: `hash${i}${Math.random().toString(36).substring(2, 15)}`,
      elo: 1200 + Math.floor(Math.random() * 800),
      gamesCount: Math.floor(Math.random() * 100) + 10,
      avgSuspicion: Math.floor(Math.random() * 100),
      avgEngineMatch: 60 + Math.random() * 35,
      mlProb: Math.random(),
      perfectRunStreak: Math.floor(Math.random() * 20),
      lastSeen: `${Math.floor(Math.random() * 24)} hours ago`,
      accuracyHeatmap: [],
      recentGames: []
    });
  }
  return additionalPlayers;
};

const Players: React.FC = () => {
  const [players] = useState<Player[]>([...mockPlayerData, ...generateMockPlayers(20)]);
  const [searchTerm, setSearchTerm] = useState('');
  const [suspicionFilter, setSuspicionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('suspicion');

  const getSuspicionBadge = (level: number) => {
    if (level >= 70) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle className="w-3 h-3 mr-1" />
          High Risk
        </span>
      );
    }
    if (level >= 40) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <Activity className="w-3 h-3 mr-1" />
          Suspicious
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Clean
      </span>
    );
  };

  const getSuspicionIcon = (level: number) => {
    if (level >= 70) return TrendingUp;
    if (level >= 40) return Activity;
    return TrendingDown;
  };

  const filteredAndSortedPlayers = players
    .filter(player => {
      const matchesSearch = player.hash.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSuspicion = suspicionFilter === 'all' || 
        (suspicionFilter === 'high' && player.avgSuspicion >= 70) ||
        (suspicionFilter === 'medium' && player.avgSuspicion >= 40 && player.avgSuspicion < 70) ||
        (suspicionFilter === 'low' && player.avgSuspicion < 40);
      
      return matchesSearch && matchesSuspicion;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'suspicion':
          return b.avgSuspicion - a.avgSuspicion;
        case 'elo':
          return b.elo - a.elo;
        case 'games':
          return b.gamesCount - a.gamesCount;
        case 'mlProb':
          return b.mlProb - a.mlProb;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Players</h1>
        <p className="mt-2 text-gray-600">Monitor and analyze player behavior patterns</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by player hash..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={suspicionFilter}
              onChange={(e) => setSuspicionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Risk Levels</option>
              <option value="high">High Risk (70%+)</option>
              <option value="medium">Suspicious (40-69%)</option>
              <option value="low">Clean (&lt;40%)</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="suspicion">Sort by Suspicion</option>
              <option value="elo">Sort by Elo</option>
              <option value="games">Sort by Games</option>
              <option value="mlProb">Sort by ML Probability</option>
            </select>
          </div>
        </div>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedPlayers.map((player) => {
          const SuspicionIcon = getSuspicionIcon(player.avgSuspicion);
          return (
            <div key={player.hash} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 font-mono truncate">
                    {player.hash.substring(0, 16)}...
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Last seen: {player.lastSeen}</p>
                </div>
                <div className="flex items-center space-x-1">
                  <SuspicionIcon className={`w-4 h-4 ${
                    player.avgSuspicion >= 70 ? 'text-red-500' :
                    player.avgSuspicion >= 40 ? 'text-orange-500' : 'text-green-500'
                  }`} />
                  <span className={`text-sm font-bold ${
                    player.avgSuspicion >= 70 ? 'text-red-600' :
                    player.avgSuspicion >= 40 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {player.avgSuspicion}%
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Elo</span>
                    <p className="font-semibold text-gray-900">{player.elo}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Games</span>
                    <p className="font-semibold text-gray-900">{player.gamesCount}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Engine Match</span>
                    <span className="font-medium">{player.avgEngineMatch.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-blue-500 h-1.5 rounded-full" 
                      style={{ width: `${player.avgEngineMatch}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ML Probability</span>
                    <span className="font-medium">{(player.mlProb * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-orange-500 h-1.5 rounded-full" 
                      style={{ width: `${player.mlProb * 100}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  {getSuspicionBadge(player.avgSuspicion)}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link
                  to={`/players/${player.hash}`}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAndSortedPlayers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No players found</h3>
          <p className="text-gray-500">Try adjusting your search criteria or filters.</p>
        </div>
      )}
    </div>
  );
};

export default Players;