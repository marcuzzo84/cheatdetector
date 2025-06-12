import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Activity, Calendar, Eye } from 'lucide-react';
import { mockPlayerData } from '../data/mockData';
import AccuracyHeatmap from '../components/AccuracyHeatmap';
import GameHistoryAccordion from '../components/GameHistoryAccordion';

const PlayerDetail: React.FC = () => {
  const { hash } = useParams<{ hash: string }>();
  const player = mockPlayerData.find(p => p.hash === hash) || mockPlayerData[0];
  const [pgnModalOpen, setPgnModalOpen] = useState(false);
  const [selectedPgn, setSelectedPgn] = useState('');

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

  const getChessComUrl = (playerHash: string) => {
    // In a real implementation, you'd need the actual username
    return `https://www.chess.com/member/${playerHash.substring(0, 8)}`;
  };

  const getLichessUrl = (playerHash: string) => {
    // In a real implementation, you'd need the actual username
    return `https://lichess.org/@/${playerHash.substring(0, 8)}`;
  };

  const openPgnModal = (pgn: string) => {
    setSelectedPgn(pgn);
    setPgnModalOpen(true);
  };

  const closePgnModal = () => {
    setPgnModalOpen(false);
    setSelectedPgn('');
  };

  // Sample PGN for demonstration
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

  return (
    <>
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
              <a
                href={getChessComUrl(player.hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View on Chess.com</span>
              </a>
              <a
                href={getLichessUrl(player.hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View on Lichess</span>
              </a>
              <button
                onClick={() => openPgnModal(samplePgn)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>View Full PGN</span>
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

      {/* PGN Modal */}
      {pgnModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Full PGN</h3>
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

export default PlayerDetail;