import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, AlertTriangle, CheckCircle, Clock, Filter, Search, Calendar } from 'lucide-react';
import { mockDashboardData, type Game } from '../data/mockData';

const Games: React.FC = () => {
  const [games] = useState<Game[]>(mockDashboardData.recentGames);
  const [searchTerm, setSearchTerm] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [suspicionFilter, setSuspicionFilter] = useState('all');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

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
          <Clock className="w-3 h-3 mr-1" />
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

  const getSiteBadge = (site: string) => {
    const isChessCom = site === 'Chess.com';
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
        isChessCom ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
      }`}>
        {isChessCom ? 'Chess.com' : 'Li'}
      </span>
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const filteredGames = games.filter(game => {
    const matchesSearch = game.playerHash.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSite = siteFilter === 'all' || game.site === siteFilter;
    const matchesSuspicion = suspicionFilter === 'all' || 
      (suspicionFilter === 'high' && game.suspicionLevel >= 70) ||
      (suspicionFilter === 'medium' && game.suspicionLevel >= 40 && game.suspicionLevel < 70) ||
      (suspicionFilter === 'low' && game.suspicionLevel < 40);
    
    return matchesSearch && matchesSite && matchesSuspicion;
  });

  const openGameModal = (game: Game) => {
    setSelectedGame(game);
  };

  const closeGameModal = () => {
    setSelectedGame(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Games</h1>
        <p className="mt-2 text-gray-600">Comprehensive game analysis with detailed metrics</p>
      </div>

      {/* Filters */}
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
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sites</option>
              <option value="Chess.com">Chess.com</option>
              <option value="Lichess">Lichess</option>
            </select>
            
            <select
              value={suspicionFilter}
              onChange={(e) => setSuspicionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="high">High Risk (70%+)</option>
              <option value="medium">Suspicious (40-69%)</option>
              <option value="low">Clean (&lt;40%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Games Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Game Analysis Results ({filteredGames.length} games)
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Elo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Link
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Match %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ML-prob
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGames.map((game) => (
                <tr 
                  key={game.id} 
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openGameModal(game)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatTime(game.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSiteBadge(game.site)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {game.elo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link 
                      to={`/players/${game.playerHash}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 font-mono"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {game.playerHash.substring(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {game.matchEnginePct.toFixed(0)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {game.mlProb.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                        game.suspicionLevel >= 70 ? 'bg-red-500 text-white' :
                        game.suspicionLevel >= 40 ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'
                      }`}>
                        {game.suspicionLevel}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <Link
                      to={`/players/${game.playerHash}`}
                      className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Link>
                    <button 
                      className="text-green-600 hover:text-green-800 inline-flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      PGN
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Game Detail Modal */}
      {selectedGame && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Game Analysis Details</h3>
                <button
                  onClick={closeGameModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Game Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Player Hash:</span>
                        <span className="font-mono">{selectedGame.playerHash.substring(0, 16)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Site:</span>
                        <span>{selectedGame.site}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Elo:</span>
                        <span>{selectedGame.elo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date:</span>
                        <span>{formatTime(selectedGame.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Analysis Metrics</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Engine Match:</span>
                        <span>{selectedGame.matchEnginePct.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">ML Probability:</span>
                        <span>{selectedGame.mlProb.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Suspicion Level:</span>
                        <span className={`font-bold ${
                          selectedGame.suspicionLevel >= 70 ? 'text-red-600' :
                          selectedGame.suspicionLevel >= 40 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {selectedGame.suspicionLevel}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Move Accuracy Heatmap</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-10 gap-1">
                        {Array.from({ length: 40 }, (_, i) => {
                          const accuracy = 75 + Math.random() * 20;
                          const isHighAccuracy = accuracy >= 95;
                          return (
                            <div
                              key={i}
                              className={`w-6 h-6 rounded text-xs flex items-center justify-center text-white font-medium ${
                                isHighAccuracy ? 'bg-red-500' : 'bg-green-400'
                              }`}
                              title={`Move ${i + 1}: ${accuracy.toFixed(0)}%`}
                            >
                              {i + 1}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Red cells indicate suspiciously high accuracy (95%+)
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">PGN Preview</h4>
                    <div className="bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto max-h-32">
                      <pre className="whitespace-pre-wrap">
                        [Event "Rated Blitz game"]
                        [Site "{selectedGame.site}"]
                        [Date "{formatTime(selectedGame.timestamp)}"]
                        [White "Player"]
                        [Black "Opponent"]
                        [Result "{selectedGame.result}"]
                        
                        1. e4 e5 2. Nf3 Nc6 3. Bb5 a6...
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={closeGameModal}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
                <Link
                  to={`/players/${selectedGame.playerHash}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  View Player Profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Games;