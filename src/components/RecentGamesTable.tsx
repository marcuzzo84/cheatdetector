import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Game } from '../data/mockData';

interface RecentGamesTableProps {
  games: Game[];
}

const RecentGamesTable: React.FC<RecentGamesTableProps> = ({ games }) => {
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
        {site}
      </span>
    );
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Player
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Site
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Elo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Engine Match
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Suspicion
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Time
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {games.map((game) => (
            <tr key={game.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <Link 
                  to={`/players/${game.playerHash}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 font-mono"
                >
                  {game.playerHash.substring(0, 12)}...
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getSiteBadge(game.site)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {game.elo}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {game.matchEnginePct.toFixed(1)}%
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  <div className="w-full bg-gray-200 rounded-full h-2 w-16">
                    <div 
                      className={`h-2 rounded-full ${
                        game.suspicionLevel >= 70 ? 'bg-red-500' : 
                        game.suspicionLevel >= 40 ? 'bg-orange-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${game.suspicionLevel}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-900 min-w-8">{game.suspicionLevel}%</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getSuspicionBadge(game.suspicionLevel)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatTime(game.timestamp)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <Link
                  to={`/players/${game.playerHash}`}
                  className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Link>
                <button className="text-green-600 hover:text-green-800 inline-flex items-center">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  PGN
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecentGamesTable;