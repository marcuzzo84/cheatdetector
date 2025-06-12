import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface LiveGame {
  id: string;
  playerHash: string;
  site: string;
  suspicionLevel: number;
  elo: number;
  matchEnginePct: number;
  deltaCp: number;
  mlProb: number;
  timestamp: Date;
  result: string;
}

interface RecentGamesTableProps {
  games: LiveGame[];
}

const RecentGamesTable: React.FC<RecentGamesTableProps> = ({ games }) => {
  const [pgnModalOpen, setPgnModalOpen] = useState(false);
  const [selectedPgn, setSelectedPgn] = useState('');

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

  const getChessComUrl = (playerHash: string) => {
    return `https://www.chess.com/member/${playerHash.substring(0, 8)}`;
  };

  const getLichessUrl = (playerHash: string) => {
    return `https://lichess.org/@/${playerHash.substring(0, 8)}`;
  };

  const openPgnModal = () => {
    const samplePgn = `[Event "Rated Blitz game"]
[Site "lichess.org"]
[Date "2024.01.15"]
[Round "-"]
[White "PlayerX"]
[Black "Opponent"]
[Result "1-0"]
[UTCDate "2024.01.15"]
[UTCTime "14:30:00"]
[WhiteElo "1650"]
[BlackElo "1680"]
[WhiteRatingDiff "+12"]
[BlackRatingDiff "-12"]
[Variant "Standard"]
[TimeControl "300+3"]
[ECO "B20"]
[Opening "Sicilian Defense"]
[Termination "Normal"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e6 7. f3 b5 8. Qd2 Bb7 9. O-O-O Nbd7 10. h4 Rc8 11. Kb1 Qc7 12. g4 b4 13. Nce2 d5 14. exd5 Nxd5 15. Bg5 Be7 16. Bxe7 Qxe7 17. g5 O-O 18. h5 Rfd8 19. g6 hxg6 20. hxg6 f6 21. Rh7 Kf8 22. Qh2 Ke8 23. Qh8+ Kd7 24. Qxg7 Qxg7 25. Rxg7+ Kc6 26. Rxb7 Kxb7 27. Nf5 exf5 28. Rxd5 Rxd5 29. Nf4 Rd1+ 30. Ka2 Ra1+ 31. Kb3 Rb1+ 32. Kc4 Rc1+ 33. Kd3 Rd1+ 34. Ke2 Re1+ 35. Kf2 Re7 36. g7 Rxg7 37. Nxf5 Rg2+ 38. Ke3 Rxb2 39. Nxd6+ Kc6 40. Nf5 Rxa2 41. Ne7+ Kd7 42. Nf5 Ra3+ 43. Kf4 a5 44. Kg4 a4 45. Kh5 a3 46. Kg6 a2 47. Kxf6 a1=Q 48. Ne3 Qf1 49. Kg5 Qxf3 50. Ng4 Qf4+ 51. Kh5 Ra5+ 52. Ng5 Qf5 53. Kh4 Rxg5 54. Kh3 Qf3+ 55. Kh2 Rg2+ 56. Kh1 Qf1# 0-1`;
    
    setSelectedPgn(samplePgn);
    setPgnModalOpen(true);
  };

  const closePgnModal = () => {
    setPgnModalOpen(false);
    setSelectedPgn('');
  };

  if (!games || games.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No games available</p>
      </div>
    );
  }

  return (
    <>
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
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex flex-col space-y-1">
                    <div className="flex space-x-2">
                      <Link
                        to={`/players/${game.playerHash}`}
                        className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Link>
                      <button 
                        onClick={openPgnModal}
                        className="text-green-600 hover:text-green-800 inline-flex items-center"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        PGN
                      </button>
                    </div>
                    <div className="flex space-x-2">
                      <a
                        href={getChessComUrl(game.playerHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 inline-flex items-center text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Chess.com
                      </a>
                      <a
                        href={getLichessUrl(game.playerHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-800 inline-flex items-center text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Lichess
                      </a>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PGN Modal */}
      {pgnModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Sample PGN</h3>
                <button
                  onClick={closePgnModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                <pre className="text-sm font-mono whitespace-pre-wrap">{selectedPgn}</pre>
              </div>
              
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={() => navigator.clipboard.writeText(selectedPgn)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Copy PGN
                </button>
                <button
                  onClick={closePgnModal}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RecentGamesTable;